import Stripe from 'stripe';

interface StripeConnectionSettings {
  settings?: {
    publishable?: string;
    secret?: string;
  };
}

let connectionSettings: StripeConnectionSettings | undefined;
let cachedCredentials: { publishableKey: string; secretKey: string } | null = null;

async function getCredentials() {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  // First, check for direct environment variables (preferred method)
  const envSecretKey = process.env.STRIPE_SECRET_KEY;
  const envPublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (envSecretKey && envPublishableKey) {
    console.log('[Stripe] Using API keys from environment variables');
    cachedCredentials = {
      publishableKey: envPublishableKey,
      secretKey: envSecretKey,
    };
    return cachedCredentials;
  }

  // Fall back to Replit connector if env vars not set
  console.log('[Stripe] Environment variables not found, trying Replit connector...');
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Stripe API keys not configured. Please set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY environment variables.');
  }

  const connectorName = 'stripe';
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    });

    const data = await response.json();
    
    connectionSettings = data.items?.[0];

    if (!connectionSettings || (!connectionSettings.settings?.publishable || !connectionSettings.settings?.secret)) {
      throw new Error('Stripe connector not configured');
    }

    console.log('[Stripe] Using Replit connector');
    cachedCredentials = {
      publishableKey: connectionSettings.settings.publishable,
      secretKey: connectionSettings.settings.secret,
    };
    return cachedCredentials;
  } catch (error) {
    throw new Error('Stripe API keys not configured. Please set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY environment variables.');
  }
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey);
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: InstanceType<typeof import('stripe-replit-sync').StripeSync> | null = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
