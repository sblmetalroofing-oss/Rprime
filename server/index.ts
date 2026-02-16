import express, { type Request, Response, NextFunction, type ErrorRequestHandler } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupChatWebSocket } from "./websocket";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { seedDocumentThemes } from "./seed-themes";
import { startXeroPolling } from "./xero-polling";
import { logger, getErrorMessage } from "./logger";
import { closeDatabase } from "./db";

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

// Moved to logger.ts

const app = express();
const httpServer = createServer(app);

setupChatWebSocket(httpServer);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

async function initStripe() {
  logger.info(`Stripe Init - NODE_ENV=${process.env.NODE_ENV}`);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn('DATABASE_URL not found, skipping Stripe initialization');
    return;
  }

  try {
    logger.info('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    logger.info('Stripe schema ready');

    const stripeSync = await getStripeSync();

    // Skip webhook auto-setup in production to avoid conflicts with cached webhook records
    // Webhooks should be configured manually in Stripe dashboard for production
    if (process.env.NODE_ENV === 'production') {
      logger.info('Skipping webhook auto-setup in production deployment');
    } else {
      logger.info('Setting up managed webhook...');
      // Use explicit STRIPE_WEBHOOK_BASE_URL if set, otherwise derive from environment
      let webhookBaseUrl = process.env.STRIPE_WEBHOOK_BASE_URL;
      if (!webhookBaseUrl) {
        const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
        if (domain) {
          webhookBaseUrl = `https://${domain}`;
        }
      }

      if (webhookBaseUrl && webhookBaseUrl !== 'https://undefined') {
        try {
          const result = await stripeSync.findOrCreateManagedWebhook(
            `${webhookBaseUrl}/api/stripe/webhook`
          );
          if (result?.url) {
            logger.info(`Webhook configured: ${result.url}`);
          } else {
            logger.info('Webhook created but URL not returned');
          }
        } catch (webhookError: unknown) {
          // Don't fail startup on webhook errors - they can be retried later
          logger.warn('Webhook setup skipped', webhookError);
        }
      } else {
        logger.info('Skipping webhook setup - no webhook URL configured');
      }
    }

    logger.info('Syncing Stripe data...');
    try {
      await stripeSync.syncBackfill();
      logger.info('Stripe data synced successfully');
    } catch (syncError: unknown) {
      logger.error('Error syncing Stripe data', syncError);
      // Retry once after 5 seconds
      logger.info('Retrying Stripe sync in 5 seconds...');
      setTimeout(async () => {
        try {
          await stripeSync.syncBackfill();
          logger.info('Stripe data synced on retry');
        } catch (retryError: unknown) {
          logger.error('Stripe sync retry failed', retryError);
        }
      }, 5000);
    }
  } catch (error) {
    logger.error('Failed to initialize Stripe', error);
  }
}

// Health check endpoint for Vercel and monitoring services
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Stripe initialization is deferred to after server starts (see httpServer.listen callback)

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        logger.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: unknown) {
      logger.error('Webhook processing error', error);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Legacy log function - gradually migrate to logger
export function log(message: string, source = "express") {
  logger.log(message, source);
}

// Prevent caching of API responses to ensure fresh data
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  const errorHandler: ErrorRequestHandler = (err: HttpError, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  };
  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // If running on Vercel, export the app directly. Vercel handles server startup.
  // Otherwise, start the HTTP server for local development/other environments.
  if (process.env.VERCEL) {
    logger.info('Running on Vercel, exporting app directly.');
    // Initialize Stripe and Xero polling immediately for Vercel, as there's no listen callback
    initStripe().catch((err) => logger.error('Failed to initialize Stripe', err));
    seedDocumentThemes().catch((err) => logger.error('Failed to seed document themes', err));
    startXeroPolling();
  } else {
    // Use PORT from environment, default to 5000 for Replit deployment
    const port = parseInt(process.env.PORT || "5000", 10);
    const host = process.platform === 'win32' ? 'localhost' : '0.0.0.0';
    httpServer.listen(port, host, () => {
      logger.info(`Server listening on port ${port}`);
      // Seed document themes for organizations without any
      seedDocumentThemes().catch((err) => logger.error('Failed to seed document themes', err));
      // Initialize Stripe AFTER server starts to allow health checks to pass quickly
      initStripe().catch((err) => logger.error('Failed to initialize Stripe', err));
      // Start Xero payment polling (every 5 minutes)
      startXeroPolling();
    },
    );
  }
})();

// Export app for Vercel serverless deployment
export default app;
