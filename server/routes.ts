import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { getSession } from "./replit_integrations/auth/replitAuth";
import passport from "passport";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { configureVapid } from "./push-notifications";
import billingRoutes from "./billingRoutes";
import adminRoutes from "./adminRoutes";
import authRoutes from "./routes/authRoutes";
import xeroRoutes from "./routes/xeroRoutes";
import reportRoutes from "./routes/reportRoutes";
import jobRoutes from "./routes/jobRoutes";
import quoteRoutes from "./routes/quoteRoutes";
import invoiceRoutes from "./routes/invoiceRoutes";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes";
import leadRoutes from "./routes/leadRoutes";
import chatRoutes from "./routes/chatRoutes";
import aiRoutes from "./routes/aiRoutes";
import documentRoutes from "./routes/documentRoutes";
import customerRoutes from "./routes/customerRoutes";
import itemRoutes from "./routes/itemRoutes";
import crewRoutes from "./routes/crewRoutes";
import rflashRoutes from "./routes/rflashRoutes";
import pushRoutes from "./routes/pushRoutes";
import feedbackRoutes from "./routes/feedbackRoutes";
import miscRoutes from "./routes/miscRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import savedSectionRoutes from "./routes/savedSectionRoutes";
import { startReminderScheduler } from "./notification-service";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Set up session middleware (required for local auth)
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  
  interface PassportUserWithClaims extends Express.User {
    claims?: { sub?: string };
    id?: string;
  }
  
  passport.serializeUser((user: Express.User, cb) => {
    // Only store user ID for efficiency
    const typedUser = user as PassportUserWithClaims;
    const userId = typedUser.claims?.sub || typedUser.id;
    cb(null, userId);
  });
  
  passport.deserializeUser(async (userId: string, cb) => {
    try {
      // Fetch full user from database to ensure organizationId is present
      const user = await storage.getUser(userId);
      if (user) {
        cb(null, user);
      } else {
        cb(null, false);
      }
    } catch (err) {
      cb(err, null);
    }
  });
  
  // Register billing routes (must be after session middleware)
  app.use(billingRoutes);
  
  // Register admin routes (must be after session middleware)
  app.use(adminRoutes);
  
  // Register Xero integration routes
  app.use("/api", xeroRoutes);
  
  // Register Report routes
  app.use("/api", reportRoutes);
  
  // Register Job routes (jobs, activities, templates, checklists, appointments, crew schedule)
  app.use("/api", jobRoutes);
  
  // Register Quote routes (quotes, quote-templates, quote-template-mappings, roof-extractions)
  app.use("/api", quoteRoutes);
  
  // Register Saved Line Section routes
  app.use("/api", savedSectionRoutes);
  
  // Register Invoice routes (invoices, invoice-payments)
  app.use("/api", invoiceRoutes);
  
  // Register Purchase Order routes
  app.use("/api", purchaseOrderRoutes);
  
  // Register Lead routes (leads, reminders, attachments)
  app.use("/api", leadRoutes);
  app.use("", leadRoutes);
  
  // Register Chat and Direct Message routes
  app.use("/api", chatRoutes);
  
  // Register AI routes (AI photo analysis, PDF extraction, ML pricing patterns)
  app.use("/api", aiRoutes);
  
  // Register Document routes (document-settings, app-settings, document-themes, document-attachments)
  app.use("/api", documentRoutes);
  
  // Register Auth routes (auth, login, signup, logout, Google OAuth, password reset)
  app.use("/api", authRoutes);
  
  // Register Customer and Supplier routes
  app.use("/api", customerRoutes);
  
  // Register Item routes (products, services, bundles)
  app.use("/api", itemRoutes);
  
  // Register Crew routes (crew-members, dashboard-widgets)
  app.use("/api", crewRoutes);
  
  // Register RFlash routes (flashing materials, orders, profiles, templates)
  app.use("/api", rflashRoutes);
  
  // Configure VAPID keys for push notifications
  configureVapid();
  
  // Register Push Notification routes
  app.use("/api", pushRoutes);
  
  // Register Feedback and Behavior tracking routes
  app.use("/api", feedbackRoutes);
  
  // Register Notification routes (crew member notifications)
  app.use("/api", notificationRoutes);

  // Register Miscellaneous routes (notifications, uploads, email, public views)
  app.use("/api", miscRoutes);
  
  registerObjectStorageRoutes(app);
  
  startReminderScheduler();

  return httpServer;
}
