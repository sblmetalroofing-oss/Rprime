import { Router, Request, Response } from "express";
import { db } from "./db";
import { organizations, users, crewMembers, Organization } from "@shared/schema";
import { eq, sql, and, gte, lte, isNull, or } from "drizzle-orm";
import { getUncachableStripeClient, getStripePublishableKey, getStripeSync } from "./stripeClient";
import { randomUUID } from "crypto";
import { getResendClient } from "./email";
import Stripe from "stripe";

// Session user data structure
interface SessionUser {
  id?: string;
  email?: string;
}

// User claims structure (from auth tokens)
interface UserClaims {
  sub?: string;
  email?: string;
}

// Extended user property on request
interface RequestUser {
  id?: string;
  email?: string;
  claims?: UserClaims;
}

// Helper to extract userId from various auth sources on request
function getUserId(req: Request): string | undefined {
  const session = req.session as { user?: SessionUser } | undefined;
  const user = (req as Request & { user?: RequestUser }).user;
  return session?.user?.id || user?.id || user?.claims?.sub;
}

// Helper to extract userEmail from various auth sources on request
function getUserEmail(req: Request): string | undefined {
  const session = req.session as { user?: SessionUser } | undefined;
  const user = (req as Request & { user?: RequestUser }).user;
  return session?.user?.email || user?.email || user?.claims?.email;
}

// Types for Stripe database query results
interface StripeProductRow {
  product_id: string;
  product_name: string;
  product_description: string | null;
  product_metadata: Record<string, string> | null;
  price_id: string | null;
  unit_amount: number | null;
  currency: string | null;
  recurring: Record<string, unknown> | null;
}

interface StripePriceRow {
  price_id: string;
  price_active: boolean;
  price_metadata: Record<string, string> | null;
  product_id: string;
  product_name: string;
  product_metadata: Record<string, string> | null;
  product_active: boolean;
}

interface StripeSubscriptionRow {
  id: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end?: boolean;
  [key: string]: unknown; // Allow other subscription fields from Stripe sync
}

interface CountRow {
  count: number | string;
}

// Type for organization update fields
type OrganizationUpdate = Partial<Pick<Organization, 
  'name' | 'businessName' | 'abn' | 'email' | 'phone' | 'address' | 'suburb' | 'state' | 'postcode' |
  'subscriptionPlan' | 'subscriptionStatus' | 'trialEndsAt' | 'updatedAt'
>>;

const router = Router();

// Test Stripe connection - Super admin only
router.get("/api/stripe/test", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!currentUser?.isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    
    const stripe = await getUncachableStripeClient();
    const account = await stripe.accounts.retrieve();
    res.json({ 
      success: true, 
      message: "Stripe connection successful",
      account: {
        id: account.id,
        business_profile: account.business_profile?.name || null,
        country: account.country,
        default_currency: account.default_currency
      }
    });
  } catch (error: unknown) {
    console.error("Stripe connection test failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to connect to Stripe";
    res.status(500).json({ 
      success: false, 
      error: errorMessage
    });
  }
});

router.get("/api/billing/publishable-key", async (req, res) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ publishableKey: key });
  } catch (error) {
    console.error("Error getting publishable key:", error);
    res.status(500).json({ error: "Failed to get publishable key" });
  }
});

router.post("/api/billing/sync", async (req: Request, res: Response) => {
  try {
    // Super admin only - this triggers Stripe sync operations
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!currentUser?.isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    
    console.log('[Billing] Manual Stripe sync requested...');
    const stripeSync = await getStripeSync();
    await stripeSync.syncBackfill();
    console.log('[Billing] Stripe sync completed successfully');
    
    const products = await db.execute(
      sql`SELECT COUNT(*) as count FROM stripe.products WHERE active = true`
    );
    const prices = await db.execute(
      sql`SELECT COUNT(*) as count FROM stripe.prices WHERE active = true`
    );
    
    res.json({ 
      success: true, 
      message: "Stripe data synced successfully",
      productCount: (products.rows[0] as unknown as CountRow)?.count || 0,
      priceCount: (prices.rows[0] as unknown as CountRow)?.count || 0
    });
  } catch (error) {
    console.error("Error syncing Stripe data:", error);
    res.status(500).json({ error: "Failed to sync Stripe data", details: String(error) });
  }
});

router.get("/api/billing/products", async (req: Request, res: Response) => {
  try {
    // Require authentication
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    // Verify user exists and belongs to an organization
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!currentUser) {
      return res.status(401).json({ error: "User not found" });
    }
    
    // Require organization membership to view products
    if (!currentUser.organizationId) {
      return res.status(403).json({ error: "Organization membership required" });
    }
    
    const isSuperAdmin = currentUser.isSuperAdmin === true;
    
    // Check if user is organization owner
    const [org] = await db.select()
      .from(organizations)
      .where(eq(organizations.id, currentUser.organizationId));
    const isOwner = org?.ownerId === userId;
    
    // Check if user is admin or manager via crew member role
    let isAdminOrManager = false;
    if (currentUser.email) {
      const [crewMember] = await db.select()
        .from(crewMembers)
        .where(sql`lower(${crewMembers.email}) = ${currentUser.email.toLowerCase()} AND ${crewMembers.organizationId} = ${currentUser.organizationId}`)
        .limit(1);
      if (crewMember) {
        const role = crewMember.role?.toLowerCase();
        isAdminOrManager = role === 'admin' || role === 'manager' || role === 'owner';
      }
    }
    
    // Only allow owners, admins, managers, or super admins to view billing products
    if (!isOwner && !isAdminOrManager && !isSuperAdmin) {
      return res.status(403).json({ error: "Access denied. Only organization owners, admins, or managers can view billing products." });
    }
    
    const products = await db.execute(
      sql`SELECT 
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.metadata as product_metadata,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY pr.unit_amount ASC`
    );
    
    const productsMap = new Map();
    for (const row of products.rows as unknown as StripeProductRow[]) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          metadata: row.product_metadata,
          prices: []
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
        });
      }
    }
    
    res.json({ products: Array.from(productsMap.values()) });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.json({ products: [] });
  }
});

router.get("/api/billing/organization", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    // First check if user already belongs to an organization via their user record
    const [currentUser] = await db.select()
      .from(users)
      .where(eq(users.id, userId));
    
    let org = null;
    
    // Priority 1: User's assigned organizationId
    if (currentUser?.organizationId) {
      const [orgById] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, currentUser.organizationId));
      org = orgById;
    }
    
    // Priority 2: Organization where user is owner (fallback)
    if (!org) {
      const [orgByOwner] = await db.select()
        .from(organizations)
        .where(eq(organizations.ownerId, userId));
      org = orgByOwner;
    }
    
    if (!org) {
      return res.json({ organization: null });
    }
    
    // Authorization: Only owner or super admin can access full billing organization data
    const isOwner = org.ownerId === userId;
    const isSuperAdmin = currentUser?.isSuperAdmin === true;
    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({ error: "Access denied. Only organization owners can access billing." });
    }
    
    let subscription = null;
    if (org.stripeSubscriptionId) {
      try {
        const subResult = await db.execute(
          sql`SELECT * FROM stripe.subscriptions WHERE id = ${org.stripeSubscriptionId}`
        );
        subscription = subResult.rows[0] || null;
      } catch (e) {
        console.error("Error fetching subscription:", e);
      }
    }
    
    res.json({ organization: org, subscription });
  } catch (error) {
    console.error("Error fetching organization:", error);
    res.status(500).json({ error: "Failed to fetch organization" });
  }
});

router.post("/api/billing/organization", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { name, businessName, abn, email, phone, address, suburb, state, postcode } = req.body;
    
    // First check if user already belongs to an organization via their user record
    const [currentUser] = await db.select()
      .from(users)
      .where(eq(users.id, userId));
    
    let existing = null;
    
    // Priority 1: User's assigned organizationId
    if (currentUser?.organizationId) {
      const [orgById] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, currentUser.organizationId));
      existing = orgById;
    }
    
    // Priority 2: Organization where user is owner (fallback)
    if (!existing) {
      const [orgByOwner] = await db.select()
        .from(organizations)
        .where(eq(organizations.ownerId, userId));
      existing = orgByOwner;
    }
    
    if (existing) {
      // Authorization: Only owner or super admin can update organization billing info
      const isOwner = existing.ownerId === userId;
      const isSuperAdmin = currentUser?.isSuperAdmin === true;
      if (!isOwner && !isSuperAdmin) {
        return res.status(403).json({ error: "Access denied. Only organization owners can update billing." });
      }
      
      // Update existing organization - preserve trial dates!
      const [updated] = await db.update(organizations)
        .set({ name, businessName, abn, email, phone, address, suburb, state, postcode, updatedAt: new Date() })
        .where(eq(organizations.id, existing.id))
        .returning();
      return res.json({ organization: updated });
    }
    
    // Only create new organization if user truly has none
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    
    const [org] = await db.insert(organizations)
      .values({
        id: randomUUID(),
        name,
        businessName,
        abn,
        email,
        phone,
        address,
        suburb,
        state,
        postcode,
        ownerId: userId,
        subscriptionStatus: "trialing",
        trialEndsAt,
      })
      .returning();
    
    // Link the new organization to the user
    await db.update(users)
      .set({ organizationId: org.id })
      .where(eq(users.id, userId));
    
    res.json({ organization: org });
  } catch (error) {
    console.error("Error creating organization:", error);
    res.status(500).json({ error: "Failed to create organization" });
  }
});

router.post("/api/billing/create-checkout", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const userEmail = getUserEmail(req);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { priceId } = req.body;
    
    if (!priceId) {
      return res.status(400).json({ error: "Price ID is required" });
    }
    
    // Get user to check permissions
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    const isSuperAdmin = currentUser?.isSuperAdmin === true;
    
    // Find org either as owner or via user's organizationId (for super admin)
    let org = null;
    const [orgByOwner] = await db.select()
      .from(organizations)
      .where(eq(organizations.ownerId, userId));
    org = orgByOwner;
    
    // Super admin can access org via user's organizationId
    if (!org && isSuperAdmin && currentUser?.organizationId) {
      const [orgById] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, currentUser.organizationId));
      org = orgById;
    }
    
    // If user has an organizationId but couldn't find org as owner, check their org and verify permissions
    if (!org && currentUser?.organizationId) {
      const [userOrg] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, currentUser.organizationId));
      // User has an org but isn't the owner - deny access (crew member case)
      if (userOrg && userOrg.ownerId !== userId && !isSuperAdmin) {
        return res.status(403).json({ error: "Access denied. Only organization owners can manage billing." });
      }
    }
    
    // Verify user is owner or super admin (if org was found)
    if (org && org.ownerId !== userId && !isSuperAdmin) {
      return res.status(403).json({ error: "Access denied. Only organization owners can manage billing." });
    }
    
    // Ensure organization exists before any Stripe operations
    if (!org?.id) {
      return res.status(400).json({ error: "Please save your business details first" });
    }
    
    const stripe = await getUncachableStripeClient();
    
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail || org.email || undefined,
        metadata: {
          userId,
          organizationId: org.id,
        },
      });
      customerId = customer.id;
      
      await db.update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, org.id));
    }
    
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: org.id,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          userId,
          organizationId: org.id,
        },
      },
      metadata: {
        userId,
        organizationId: org.id,
      },
      success_url: `${baseUrl}/billing?success=true`,
      cancel_url: `${baseUrl}/billing?canceled=true`,
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/api/billing/create-portal", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    // Get user to check permissions
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    const isSuperAdmin = currentUser?.isSuperAdmin === true;
    
    // Find org either as owner or via user's organizationId (for super admin)
    let org = null;
    const [orgByOwner] = await db.select()
      .from(organizations)
      .where(eq(organizations.ownerId, userId));
    org = orgByOwner;
    
    if (!org && isSuperAdmin && currentUser?.organizationId) {
      const [orgById] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, currentUser.organizationId));
      org = orgById;
    }
    
    // Verify user is owner or super admin
    if (!org || (org.ownerId !== userId && !isSuperAdmin)) {
      return res.status(403).json({ error: "Access denied. Only organization owners can access billing portal." });
    }
    
    if (!org.stripeCustomerId) {
      return res.status(400).json({ error: "No billing account found" });
    }
    
    const stripe = await getUncachableStripeClient();
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${baseUrl}/billing`,
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

router.get("/api/billing/subscription", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    // First check if user belongs to an organization via their user record
    const [currentUser] = await db.select()
      .from(users)
      .where(eq(users.id, userId));
    
    let org = null;
    
    // Priority 1: User's assigned organizationId
    if (currentUser?.organizationId) {
      const [orgById] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, currentUser.organizationId));
      org = orgById;
    }
    
    // Priority 2: Organization where user is owner (fallback)
    if (!org) {
      const [orgByOwner] = await db.select()
        .from(organizations)
        .where(eq(organizations.ownerId, userId));
      org = orgByOwner;
    }
    
    if (!org) {
      return res.json({ subscription: null, status: "no_organization" });
    }
    
    // Check if user is owner or super admin - only they get full billing details
    const isOwner = org.ownerId === userId;
    const isSuperAdmin = currentUser?.isSuperAdmin === true;
    const canAccessFullBilling = isOwner || isSuperAdmin;
    
    // For non-owners, return only what's needed for plan/feature access (no sensitive billing data)
    const limitedOrg = canAccessFullBilling ? org : {
      id: org.id,
      name: org.name,
      subscriptionPlan: org.subscriptionPlan,
      subscriptionStatus: org.subscriptionStatus,
      trialEndsAt: org.trialEndsAt,
      planOverride: org.planOverride,
      billingOverride: org.billingOverride,
    };
    
    if (!org.stripeSubscriptionId) {
      return res.json({
        subscription: null,
        status: org.subscriptionStatus || "trialing",
        trialEndsAt: org.trialEndsAt,
        organization: limitedOrg,
      });
    }
    
    try {
      const subResult = await db.execute(
        sql`SELECT * FROM stripe.subscriptions WHERE id = ${org.stripeSubscriptionId}`
      );
      const subscription = subResult.rows[0] || null;
      
      // For non-owners, hide sensitive subscription details
      const typedSub = subscription as StripeSubscriptionRow | null;
      const limitedSub = canAccessFullBilling ? subscription : (typedSub ? {
        status: typedSub.status,
        current_period_end: typedSub.current_period_end,
      } : null);
      
      res.json({
        subscription: limitedSub,
        status: typedSub?.status || org.subscriptionStatus,
        organization: limitedOrg,
      });
    } catch (e) {
      res.json({
        subscription: null,
        status: org.subscriptionStatus || "trialing",
        trialEndsAt: org.trialEndsAt,
        organization: limitedOrg,
      });
    }
  } catch (error) {
    console.error("Error fetching subscription:", error);
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

router.get("/api/billing/invoices", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const [org] = await db.select()
      .from(organizations)
      .where(eq(organizations.ownerId, userId));
    
    if (!org?.stripeCustomerId) {
      return res.json({ invoices: [] });
    }
    
    const stripe = await getUncachableStripeClient();
    const invoices = await stripe.invoices.list({
      customer: org.stripeCustomerId,
      limit: 24,
    });
    
    res.json({
      invoices: invoices.data.map(inv => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amount_due: inv.amount_due,
        amount_paid: inv.amount_paid,
        currency: inv.currency,
        created: inv.created,
        period_start: inv.period_start,
        period_end: inv.period_end,
        hosted_invoice_url: inv.hosted_invoice_url,
        invoice_pdf: inv.invoice_pdf,
      })),
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.json({ invoices: [] });
  }
});

// Admin routes have been moved to adminRoutes.ts - use requireSuperAdmin middleware there
// These routes were duplicates that used incorrect admin checks

router.post("/api/admin/extend-trial", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!currentUser?.isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    
    const { organizationId, daysToAdd } = req.body;
    
    if (!organizationId || !daysToAdd) {
      return res.status(400).json({ error: "organizationId and daysToAdd required" });
    }
    
    const [org] = await db.select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    const currentTrialEnd = org.trialEndsAt || new Date();
    const newTrialEnd = new Date(currentTrialEnd);
    newTrialEnd.setDate(newTrialEnd.getDate() + daysToAdd);
    
    const [updated] = await db.update(organizations)
      .set({ 
        trialEndsAt: newTrialEnd,
        subscriptionStatus: "trialing",
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning();
    
    res.json({ organization: updated });
  } catch (error) {
    console.error("Error extending trial:", error);
    res.status(500).json({ error: "Failed to extend trial" });
  }
});

router.post("/api/admin/update-plan", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!currentUser?.isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    
    const { organizationId, plan, status } = req.body;
    
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId required" });
    }
    
    const updates: OrganizationUpdate = { updatedAt: new Date() };
    if (plan) updates.subscriptionPlan = plan;
    if (status) updates.subscriptionStatus = status;
    
    const [updated] = await db.update(organizations)
      .set(updates)
      .where(eq(organizations.id, organizationId))
      .returning();
    
    res.json({ organization: updated });
  } catch (error) {
    console.error("Error updating plan:", error);
    res.status(500).json({ error: "Failed to update plan" });
  }
});

async function sendTrialReminderEmail(org: Organization, daysLeft: number) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const subject = daysLeft === 1 
      ? `Your RPrime trial expires tomorrow!` 
      : `Your RPrime trial expires in ${daysLeft} days`;
    
    const baseUrl = process.env.APP_URL || (process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : '');
    const upgradeUrl = `${baseUrl}/billing`;
    
    const urgencyColor = daysLeft === 1 ? '#dc2626' : '#f59e0b';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background-color: ${urgencyColor}; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">
              ${daysLeft === 1 ? 'Your Trial Expires Tomorrow!' : `${daysLeft} Days Left on Your Trial`}
            </h1>
          </div>
          
          <div style="padding: 32px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
              Hi ${org.name || 'there'},
            </p>
            
            <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
              Your RPrime free trial ${daysLeft === 1 ? 'expires tomorrow' : `will expire in ${daysLeft} days`}. 
              To continue using all the features you've been enjoying, please upgrade to a paid plan.
            </p>
            
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 12px 0; color: #333;">What you'll lose access to:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #666;">
                <li>Job management and scheduling</li>
                <li>Quote and invoice generation</li>
                <li>Customer relationship management</li>
                <li>Roof inspection reports</li>
                <li>Team collaboration features</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${upgradeUrl}" style="display: inline-block; background-color: #3e4f61; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Upgrade Now
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 32px;">
              Questions? Simply reply to this email and we'll be happy to help.
            </p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 24px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="font-size: 14px; color: #666; margin: 0;">
              RPrime - Job Management for Trades
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    if (org.email) {
      await client.emails.send({
        from: fromEmail,
        to: org.email,
        subject: subject,
        html: htmlContent,
      });
      console.log(`Trial reminder email sent to ${org.email} (${daysLeft} days left)`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error sending trial reminder email:', error);
    return false;
  }
}

router.post("/api/billing/send-trial-reminders", async (req: Request, res: Response) => {
  try {
    // Super admin only - this sends emails to all trialing organizations
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!currentUser?.isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    
    const orgsToNotify = await db.select()
      .from(organizations)
      .where(
        and(
          eq(organizations.subscriptionStatus, "trialing"),
          isNull(organizations.stripeSubscriptionId)
        )
      );
    
    let emailsSent = 0;
    
    for (const org of orgsToNotify) {
      if (!org.trialEndsAt || !org.email) continue;
      
      const trialEnd = new Date(org.trialEndsAt);
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft === 3 || daysLeft === 1) {
        // lastTrialReminder is not in the schema, check for any stored reminder state
        const lastReminder = (org as Organization & { lastTrialReminder?: string }).lastTrialReminder;
        const reminderKey = `${daysLeft}day`;
        
        if (!lastReminder || !lastReminder.includes(reminderKey)) {
          const sent = await sendTrialReminderEmail(org, daysLeft);
          if (sent) {
            emailsSent++;
            const newReminder = lastReminder ? `${lastReminder},${reminderKey}` : reminderKey;
            await db.update(organizations)
              .set({ updatedAt: new Date() })
              .where(eq(organizations.id, org.id));
          }
        }
      }
    }
    
    res.json({ success: true, emailsSent });
  } catch (error) {
    console.error("Error sending trial reminders:", error);
    res.status(500).json({ error: "Failed to send trial reminders" });
  }
});

router.get("/api/billing/check-trial-reminders", async (req: Request, res: Response) => {
  try {
    // Super admin only - this exposes organization emails
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!currentUser?.isSuperAdmin) {
      return res.status(403).json({ error: "Super admin access required" });
    }
    
    const now = new Date();
    
    const orgsToNotify = await db.select()
      .from(organizations)
      .where(
        and(
          eq(organizations.subscriptionStatus, "trialing"),
          isNull(organizations.stripeSubscriptionId)
        )
      );
    
    const reminders = [];
    
    for (const org of orgsToNotify) {
      if (!org.trialEndsAt) continue;
      
      const trialEnd = new Date(org.trialEndsAt);
      const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft <= 3 && daysLeft > 0) {
        reminders.push({
          orgId: org.id,
          orgName: org.name,
          email: org.email,
          daysLeft,
          trialEndsAt: org.trialEndsAt,
        });
      }
    }
    
    res.json({ reminders });
  } catch (error) {
    console.error("Error checking trial reminders:", error);
    res.status(500).json({ error: "Failed to check trial reminders" });
  }
});

router.post("/api/billing/change-plan", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { priceId } = req.body;
    
    if (!priceId) {
      return res.status(400).json({ error: "Price ID is required" });
    }
    
    // Get user to check permissions
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    const isSuperAdmin = currentUser?.isSuperAdmin === true;
    
    // Find org either as owner or via user's organizationId (for super admin)
    let org = null;
    const [orgByOwner] = await db.select()
      .from(organizations)
      .where(eq(organizations.ownerId, userId));
    org = orgByOwner;
    
    if (!org && isSuperAdmin && currentUser?.organizationId) {
      const [orgById] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, currentUser.organizationId));
      org = orgById;
    }
    
    // Verify user is owner or super admin
    if (!org || (org.ownerId !== userId && !isSuperAdmin)) {
      return res.status(403).json({ error: "Access denied. Only organization owners can change plans." });
    }
    
    if (!org.stripeSubscriptionId) {
      return res.status(400).json({ error: "No active subscription found" });
    }
    
    const stripe = await getUncachableStripeClient();
    
    // Validate that the price exists and belongs to our approved RPrime products
    // Query our local stripe.prices and stripe.products tables for approved prices
    const priceResult = await db.execute(
      sql`SELECT 
        pr.id as price_id, 
        pr.active as price_active,
        pr.metadata as price_metadata,
        p.id as product_id,
        p.name as product_name,
        p.metadata as product_metadata,
        p.active as product_active
      FROM stripe.prices pr
      JOIN stripe.products p ON p.id = pr.product
      WHERE pr.id = ${priceId}`
    );
    
    if (!priceResult.rows || priceResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid plan. Please select a valid subscription plan." });
    }
    
    const approvedPrice = priceResult.rows[0] as unknown as StripePriceRow;
    
    if (!approvedPrice.price_active || !approvedPrice.product_active) {
      return res.status(400).json({ error: "Selected plan is not currently available." });
    }
    
    // Use metadata from our approved product database for plan derivation
    const productName = (approvedPrice.product_name || '').toLowerCase();
    const priceMeta = (approvedPrice.price_metadata?.plan || approvedPrice.price_metadata?.plan_type || '').toLowerCase();
    const productMeta = (approvedPrice.product_metadata?.plan || approvedPrice.product_metadata?.plan_type || '').toLowerCase();
    const combined = `${productName} ${priceMeta} ${productMeta}`;
    
    const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
    
    if (!subscription || !subscription.items?.data?.[0]?.id) {
      return res.status(400).json({ error: "Could not retrieve subscription details" });
    }
    
    const updatedSubscription = await stripe.subscriptions.update(org.stripeSubscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: priceId,
      }],
      proration_behavior: 'create_prorations',
    });
    
    // Derive plan from our validated product metadata
    let plan = 'business';
    if (combined.includes('starter') || combined.includes('basic')) {
      plan = 'starter';
    } else if (combined.includes('professional') || combined.includes('pro')) {
      plan = 'professional';
    }
    
    // Update organization with new plan immediately
    await db.update(organizations)
      .set({
        subscriptionPlan: plan,
        subscriptionStatus: updatedSubscription.status,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, org.id));
    
    res.json({ success: true, subscription: updatedSubscription });
  } catch (error: unknown) {
    console.error("Error changing plan:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to change plan";
    res.status(500).json({ error: errorMessage });
  }
});

router.post("/api/billing/cancel-subscription", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { cancelAtPeriodEnd = true } = req.body;
    
    // Get user to check permissions
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    const isSuperAdmin = currentUser?.isSuperAdmin === true;
    
    // Find org either as owner or via user's organizationId (for super admin)
    let org = null;
    const [orgByOwner] = await db.select()
      .from(organizations)
      .where(eq(organizations.ownerId, userId));
    org = orgByOwner;
    
    if (!org && isSuperAdmin && currentUser?.organizationId) {
      const [orgById] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, currentUser.organizationId));
      org = orgById;
    }
    
    // Verify user is owner or super admin
    if (!org || (org.ownerId !== userId && !isSuperAdmin)) {
      return res.status(403).json({ error: "Access denied. Only organization owners can cancel subscriptions." });
    }
    
    if (!org.stripeSubscriptionId) {
      return res.status(400).json({ error: "No active subscription found" });
    }
    
    const stripe = await getUncachableStripeClient();
    
    let cancelAt: number | null = null;
    
    if (cancelAtPeriodEnd) {
      // Schedule cancellation at end of billing period
      const updatedSubscription = await stripe.subscriptions.update(org.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      // Type assertion needed due to Stripe SDK response wrapper type
      cancelAt = (updatedSubscription as unknown as { current_period_end: number }).current_period_end;
      // Status remains active, webhook will update when actually canceled
    } else {
      // Immediate cancellation
      const canceledSubscription = await stripe.subscriptions.cancel(org.stripeSubscriptionId);
      cancelAt = canceledSubscription.canceled_at;
      
      // Update organization immediately for immediate cancellation
      await db.update(organizations)
        .set({
          subscriptionStatus: 'canceled',
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, org.id));
    }
    
    res.json({ success: true, cancelAt });
  } catch (error: unknown) {
    console.error("Error canceling subscription:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to cancel subscription";
    res.status(500).json({ error: errorMessage });
  }
});

router.post("/api/billing/resume-subscription", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    // Get user to check permissions
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    const isSuperAdmin = currentUser?.isSuperAdmin === true;
    
    // Find org either as owner or via user's organizationId (for super admin)
    let org = null;
    const [orgByOwner] = await db.select()
      .from(organizations)
      .where(eq(organizations.ownerId, userId));
    org = orgByOwner;
    
    if (!org && isSuperAdmin && currentUser?.organizationId) {
      const [orgById] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, currentUser.organizationId));
      org = orgById;
    }
    
    // Verify user is owner or super admin
    if (!org || (org.ownerId !== userId && !isSuperAdmin)) {
      return res.status(403).json({ error: "Access denied. Only organization owners can resume subscriptions." });
    }
    
    if (!org.stripeSubscriptionId) {
      return res.status(400).json({ error: "No subscription found" });
    }
    
    const stripe = await getUncachableStripeClient();
    
    await stripe.subscriptions.update(org.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });
    
    res.json({ success: true });
  } catch (error: unknown) {
    console.error("Error resuming subscription:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to resume subscription";
    res.status(500).json({ error: errorMessage });
  }
});

router.post("/api/billing/update-payment-method", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { paymentMethodId } = req.body;
    
    if (!paymentMethodId) {
      return res.status(400).json({ error: "Payment method ID is required" });
    }
    
    // Get user to check permissions
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    const isSuperAdmin = currentUser?.isSuperAdmin === true;
    
    // Find org either as owner or via user's organizationId (for super admin)
    let org = null;
    const [orgByOwner] = await db.select()
      .from(organizations)
      .where(eq(organizations.ownerId, userId));
    org = orgByOwner;
    
    if (!org && isSuperAdmin && currentUser?.organizationId) {
      const [orgById] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, currentUser.organizationId));
      org = orgById;
    }
    
    // Verify user is owner or super admin
    if (!org || (org.ownerId !== userId && !isSuperAdmin)) {
      return res.status(403).json({ error: "Access denied. Only organization owners can update payment methods." });
    }
    
    if (!org.stripeCustomerId) {
      return res.status(400).json({ error: "No billing account found" });
    }
    
    const stripe = await getUncachableStripeClient();
    
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: org.stripeCustomerId,
    });
    
    await stripe.customers.update(org.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    
    res.json({ success: true });
  } catch (error: unknown) {
    console.error("Error updating payment method:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update payment method";
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
