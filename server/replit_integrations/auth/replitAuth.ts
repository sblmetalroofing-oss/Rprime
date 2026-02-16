import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import { db } from "../../db";
import { users, organizations, crewMembers } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

interface OIDCClaims {
  sub: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
  exp?: number;
}

interface AuthUserSession {
  claims?: OIDCClaims;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 100 * 24 * 60 * 60 * 1000; // 100 days
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  // Use sameSite='none' and secure=true for all environments on Replit
  // This is required for OAuth callbacks from external providers like Xero
  // Replit dev domains use HTTPS, so secure cookies work in dev too
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      maxAge: sessionTtl,
      domain: cookieDomain,
    },
  });
}

function updateUserSession(
  user: AuthUserSession,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims() as OIDCClaims;
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: OIDCClaims): Promise<{ success: boolean; error?: string; organizationId?: string }> {
  const email = claims["email"]?.toLowerCase();
  
  if (!email) {
    return { success: false, error: "No email provided" };
  }
  
  // Check if user's email matches a crew member
  const [crewMember] = await db.select().from(crewMembers)
    .where(sql`lower(${crewMembers.email}) = ${email}`)
    .limit(1);
  
  if (!crewMember) {
    return { 
      success: false, 
      error: "Your email is not authorized. Please contact your administrator to be added as a crew member." 
    };
  }
  
  // Upsert the user with organizationId from crew member
  const user = await authStorage.upsertUser({
    id: claims["sub"],
    email: email,
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
  
  // Ensure user has organizationId set
  if (!user.organizationId && crewMember.organizationId) {
    await db.update(users)
      .set({ organizationId: crewMember.organizationId, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }
  
  // Link crew member to user if not already linked
  if (!crewMember.userId || crewMember.userId !== user.id) {
    await db.update(crewMembers)
      .set({ 
        userId: user.id, 
        inviteStatus: 'accepted',
        updatedAt: new Date() 
      })
      .where(eq(crewMembers.id, crewMember.id));
  }
  
  return { success: true, organizationId: crewMember.organizationId || undefined };
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const claims = tokens.claims();
    if (!claims) {
      return verified(new Error("No claims in token"), false);
    }
    
    const user: AuthUserSession = {};
    updateUserSession(user, tokens);
    
    const result = await upsertUser(claims as OIDCClaims);
    if (!result.success) {
      // Reject login - user is not an authorized crew member
      return verified(new Error(result.error || "Not authorized"), false);
    }
    
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain
  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, (err: Error | null, user: AuthUserSession | false | null) => {
      if (err) {
        // Authentication failed - redirect to auth page with error message
        const errorMessage = encodeURIComponent(err.message || "Authentication failed");
        return res.redirect(`/auth?error=${errorMessage}`);
      }
      if (!user) {
        return res.redirect("/auth?error=Authentication%20failed");
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.redirect("/auth?error=Login%20failed");
        }
        return res.redirect("/");
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    // Clear any local auth session data first
    if (req.session) {
      (req.session as session.Session & { user?: unknown; userId?: unknown }).user = null;
      (req.session as session.Session & { user?: unknown; userId?: unknown }).userId = null;
    }
    
    req.logout(() => {
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
        }
        // Clear cookie with all possible options to ensure it's removed
        const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
        res.clearCookie("connect.sid", {
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "none" as const,
          domain: cookieDomain,
        });
        // Also try clearing without options for compatibility
        res.clearCookie("connect.sid");
        // Return JSON so frontend can handle redirect (more reliable in production)
        res.json({ success: true, redirect: "/auth" });
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (process.env.NODE_ENV === 'development' && process.env.REPL_ID === undefined && process.env.SKIP_AUTH === 'true') {
    console.warn('AUTH BYPASSED - Local development testing mode only');
    return next();
  }

  const user = req.user as AuthUserSession | undefined;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  
  // Check if token is expired and needs refresh
  if (now > user.expires_at) {
    const refreshToken = user.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  }
  
  // Check organization status (suspended/deleted)
  const userId = user.claims?.sub;
  if (userId) {
    try {
      const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
      
      let org = null;
      
      // Check user's assigned organization first
      if (currentUser?.organizationId) {
        const [orgById] = await db.select()
          .from(organizations)
          .where(eq(organizations.id, currentUser.organizationId));
        org = orgById;
      }
      
      // Then check if user is owner of an organization
      if (!org) {
        const [orgByOwner] = await db.select()
          .from(organizations)
          .where(eq(organizations.ownerId, userId));
        org = orgByOwner;
      }
      
      // Check organization status
      if (org) {
        if (org.status === 'suspended') {
          return res.status(403).json({ 
            message: "Account suspended",
            reason: org.suspendedReason || "Your account has been suspended. Please contact support.",
            code: "ACCOUNT_SUSPENDED"
          });
        }
        if (org.status === 'deleted') {
          return res.status(403).json({ 
            message: "Account deleted",
            reason: "This account has been deleted.",
            code: "ACCOUNT_DELETED"
          });
        }
      }
    } catch (error) {
      console.error("Error checking organization status:", error);
      // Don't block on org check errors, just log and continue
    }
  }
  
  return next();
};
