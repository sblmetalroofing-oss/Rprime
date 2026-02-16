import { Router, Request, Response } from "express";
import { getOrganizationId, tryLinkOrphanUser } from "./middleware";
import { checkRateLimit } from "./rateLimiter";
import { storage } from "../storage";
import passport from "passport";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users, organizations } from "@shared/schema";
import { randomUUID } from "crypto";
import {
  createLocalUser,
  createVerificationCode,
  verifyEmailCode,
  sendVerificationEmail,
  authenticateLocal,
  createPasswordResetToken,
  sendPasswordResetEmail,
  resetPassword,
  getUserByEmail,
  validateSignupEmail,
  linkUserToCrewMember,
  getCrewMemberByEmail,
} from "../auth-local";
import { getGoogleAuthUrl, handleGoogleCallback } from "../google-auth";

interface SessionUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  organizationId?: string | null;
}

interface OAuthClaims {
  sub?: string;
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  profile_image_url?: string | null;
}

interface OAuthUser {
  id?: string;
  email?: string;
  claims?: OAuthClaims;
}

interface AuthSession {
  user?: SessionUser | null;
  userId?: string | null;
  passport?: unknown;
}

type RequestWithAuth = Request & {
  session: Request['session'] & AuthSession;
  user?: OAuthUser;
  isAuthenticated?: () => boolean;
};

const router = Router();

// Development-only test login endpoint (bypasses OAuth for automated testing)
if (process.env.NODE_ENV === "development") {
  router.post("/auth/dev-login", async (req: Request, res: Response) => {
    try {
      const authReq = req as RequestWithAuth;
      const { email = "testuser@example.com", firstName = "Test", lastName = "User" } = req.body;

      const existingUser = await storage.getUserByEmail(email);

      const userId = existingUser?.id || `dev-${email.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const user = await storage.upsertUser({
        id: userId,
        email,
        firstName: existingUser?.firstName || firstName,
        lastName: existingUser?.lastName || lastName,
        profileImageUrl: existingUser?.profileImageUrl || null,
      });

      const organizationId = existingUser?.organizationId || user.organizationId;

      authReq.session.user = {
        id: user.id,
        email: user.email || email,
        firstName: user.firstName ?? undefined,
        lastName: user.lastName ?? undefined,
        organizationId: organizationId ?? undefined,
      };

      await new Promise<void>((resolve, reject) => {
        authReq.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({ success: true, user: authReq.session.user });
    } catch (error) {
      console.error("Dev login error:", error);
      res.status(500).json({ error: "Dev login failed" });
    }
  });
}

// Unified /api/auth/user endpoint - handles both Google OAuth and local auth
router.get("/auth/user", async (req: Request, res: Response) => {
  try {
    const authReq = req as RequestWithAuth;
    if (authReq.isAuthenticated && authReq.isAuthenticated() && authReq.user) {
      const user = authReq.user;

      if (user.claims) {
        const userId = user.claims.sub || user.id;
        const userEmail = user.claims.email;
        let dbUser = userId ? await storage.getUser(userId) : null;

        if (dbUser && !dbUser.organizationId && userEmail && userId) {
          const linkResult = await tryLinkOrphanUser(userId, userEmail);
          if (linkResult.linked && userId) {
            dbUser = await storage.getUser(userId);
          }
        }

        let organizationName: string | null = null;
        if (dbUser?.organizationId) {
          const [org] = await db.select({ name: organizations.name, businessName: organizations.businessName }).from(organizations).where(eq(organizations.id, dbUser.organizationId));
          organizationName = org?.businessName || org?.name || null;
        }

        return res.json({
          id: userId,
          email: userEmail,
          firstName: user.claims.first_name || null,
          lastName: user.claims.last_name || null,
          profileImageUrl: user.claims.profile_image_url || null,
          organizationId: dbUser?.organizationId || null,
          organizationName,
          isSuperAdmin: dbUser?.isSuperAdmin || false,
        });
      }

      if (user.id && user.email) {
        let dbUser = await storage.getUser(user.id);

        if (dbUser && !dbUser.organizationId) {
          const linkResult = await tryLinkOrphanUser(user.id, user.email);
          if (linkResult.linked) {
            dbUser = await storage.getUser(user.id);
          }
        }

        if (dbUser) {
          let organizationName: string | null = null;
          if (dbUser.organizationId) {
            const [org] = await db.select({ name: organizations.name, businessName: organizations.businessName }).from(organizations).where(eq(organizations.id, dbUser.organizationId));
            organizationName = org?.businessName || org?.name || null;
          }
          return res.json({
            id: dbUser.id,
            email: dbUser.email,
            firstName: dbUser.firstName,
            lastName: dbUser.lastName,
            profileImageUrl: dbUser.profileImageUrl,
            organizationId: dbUser.organizationId,
            organizationName,
            isSuperAdmin: dbUser.isSuperAdmin || false,
          });
        }
        return res.json(user);
      }
    }

    if (authReq.session?.user && authReq.session.user.id && authReq.session.user.email) {
      let dbUser = await storage.getUser(authReq.session.user.id);

      if (dbUser && !dbUser.organizationId) {
        const linkResult = await tryLinkOrphanUser(authReq.session.user.id, authReq.session.user.email);
        if (linkResult.linked) {
          dbUser = await storage.getUser(authReq.session.user.id);
        }
      }

      if (dbUser) {
        let organizationName: string | null = null;
        if (dbUser.organizationId) {
          const [org] = await db.select({ name: organizations.name, businessName: organizations.businessName }).from(organizations).where(eq(organizations.id, dbUser.organizationId));
          organizationName = org?.businessName || org?.name || null;
        }
        return res.json({
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          profileImageUrl: dbUser.profileImageUrl,
          organizationId: dbUser.organizationId,
          organizationName,
          isSuperAdmin: dbUser.isSuperAdmin || false,
        });
      }
      return res.json(authReq.session.user);
    }

    return res.json(null);
  } catch (error) {
    console.error("Error in /api/auth/user:", error);
    return res.json(null);
  }
});

// Permissions endpoint - returns billing permission flags without exposing sensitive data
router.get("/auth/permissions", async (req: Request, res: Response) => {
  try {
    const authReq = req as RequestWithAuth;
    let userId: string | null = null;

    if (authReq.isAuthenticated && authReq.isAuthenticated() && authReq.user) {
      const user = authReq.user;
      userId = user.claims?.sub || user.id || null;
    }

    if (!userId && authReq.session?.user?.id) {
      userId = authReq.session.user.id;
    }

    if (!userId) {
      return res.json({
        canManageBilling: false,
        isOrganizationOwner: false,
        isSuperAdmin: false,
      });
    }

    const dbUser = await storage.getUser(userId);
    if (!dbUser) {
      return res.json({
        canManageBilling: false,
        isOrganizationOwner: false,
        isSuperAdmin: false,
      });
    }

    const isSuperAdmin = dbUser.isSuperAdmin === true;

    let isOrganizationOwner = false;
    if (dbUser.organizationId) {
      const [org] = await db.select()
        .from(organizations)
        .where(eq(organizations.id, dbUser.organizationId));
      isOrganizationOwner = org?.ownerId === userId;
    }

    let isAdminOrManager = false;
    if (dbUser.organizationId && dbUser.email) {
      const crewMember = await getCrewMemberByEmail(dbUser.email);
      if (crewMember && crewMember.organizationId === dbUser.organizationId) {
        const role = crewMember.role?.toLowerCase();
        isAdminOrManager = role === 'admin' || role === 'manager' || role === 'owner';
      }
    }

    const canManageBilling = isSuperAdmin || isOrganizationOwner || isAdminOrManager;

    return res.json({
      canManageBilling,
      isOrganizationOwner,
      isSuperAdmin,
    });
  } catch (error) {
    console.error("Error in /api/auth/permissions:", error);
    return res.json({
      canManageBilling: false,
      isOrganizationOwner: false,
      isSuperAdmin: false,
    });
  }
});

// Local Authentication Routes
router.post("/auth/signup", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('auth', clientIp, 5, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const validation = await validateSignupEmail(email);
    if (!validation.valid) {
      return res.status(403).json({ error: validation.error });
    }

    const user = await createLocalUser(email, password, firstName, lastName);

    if (validation.crewMember) {
      await linkUserToCrewMember(user.id, validation.crewMember.id);

      if (validation.crewMember.organizationId) {
        await db.update(users)
          .set({ organizationId: validation.crewMember.organizationId })
          .where(eq(users.id, user.id));
      }
    }

    const code = await createVerificationCode(user.id, email, 'verify');
    await sendVerificationEmail(email, code, firstName);

    res.json({
      success: true,
      message: "Account created. Please check your email for verification code.",
      userId: user.id,
      email: user.email
    });
  } catch (error) {
    console.error("Signup error:", error);
    if (error instanceof Error && error.message === 'Email already registered') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.post("/auth/verify-email", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('auth', clientIp, 10, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    const result = await verifyEmailCode(email, code);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ error: "Failed to verify email" });
  }
});

router.post("/auth/resend-code", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('auth', clientIp, 3, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(400).json({ error: "Email not found" });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    const code = await createVerificationCode(user.id, email, 'verify');
    await sendVerificationEmail(email, code, user.firstName || 'User');

    res.json({ success: true, message: "Verification code sent" });
  } catch (error) {
    console.error("Resend code error:", error);
    res.status(500).json({ error: "Failed to resend code" });
  }
});

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('auth', clientIp, 10, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await authenticateLocal(email, password);

    if (!result.success) {
      if (result.error === 'Please verify your email first' && result.user) {
        return res.status(403).json({
          error: result.error,
          needsVerification: true,
          email: result.user.email
        });
      }
      return res.status(401).json({ error: result.error });
    }

    const fullUser = await storage.getUser(result.user.id);
    const organizationId = fullUser?.organizationId || null;

    const authReq = req as RequestWithAuth;
    authReq.session.userId = result.user.id;
    authReq.session.user = {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName ?? undefined,
      lastName: result.user.lastName ?? undefined,
      profileImageUrl: result.user.profileImageUrl ?? undefined,
      organizationId: organizationId ?? undefined,
    };

    authReq.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({ error: "Failed to save session" });
      }

      res.json({
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          organizationId: organizationId,
        }
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to log in" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to log out" });
    }
    res.json({ success: true });
  });
});

router.post("/auth/signup-organization", async (req: Request, res: Response) => {
  const requestId = randomUUID();
  console.log(`[${requestId}] Starting /auth/signup-organization`);
  try {
    const { businessName, ownerName, email, phone, password } = req.body;
    console.log(`[${requestId}] Request body received for email: ${email}, Business: ${businessName}`);

    if (!businessName || !ownerName || !email || !password) {
      console.log(`[${requestId}] Missing fields`);
      return res.status(400).json({ error: "Business name, owner name, email, and password are required" });
    }

    if (password.length < 8) {
      console.log(`[${requestId}] Password too short`);
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    console.log(`[${requestId}] Checking existing user...`);
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      console.log(`[${requestId}] User already exists`);
      return res.status(400).json({ error: "An account with this email already exists. Please log in instead." });
    }

    const nameParts = ownerName.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || "";

    console.log(`[${requestId}] Creating local user...`);
    const user = await createLocalUser(email, password, firstName, lastName);
    console.log(`[${requestId}] User created: ${user.id}`);

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const orgId = randomUUID();
    console.log(`[${requestId}] Creating organization ${orgId}...`);
    const [org] = await db.insert(organizations).values({
      id: orgId,
      name: businessName,
      businessName: businessName,
      email: email,
      phone: phone || null,
      ownerId: user.id,
      subscriptionStatus: "trialing",
      subscriptionPlan: "business",
      trialEndsAt: trialEndsAt,
    }).returning();
    console.log(`[${requestId}] Organization created`);

    console.log(`[${requestId}] Associating user with org...`);
    await db.update(users).set({ organizationId: orgId }).where(eq(users.id, user.id));

    console.log(`[${requestId}] Importing seed-organization...`);
    const { seedOrganizationData } = await import("../seed-organization");
    console.log(`[${requestId}] Seeding data...`);
    await seedOrganizationData({
      organizationId: orgId,
      companyName: businessName,
      ownerName: ownerName,
      ownerEmail: email,
    });
    console.log(`[${requestId}] Seed complete`);

    console.log(`[${requestId}] Sending verification email...`);
    const code = await createVerificationCode(user.id, email, 'verify');
    const emailResult = await sendVerificationEmail(email, code, firstName);

    if (!emailResult.success) {
      console.error(`[${requestId}] Failed to send verification email:`, emailResult.error);
    } else {
      console.log(`[${requestId}] Verification email sent`);
    }

    console.log(`[${requestId}] Sending success response`);
    res.json({
      success: true,
      needsVerification: true,
      email: email,
      message: "Account created! Please check your email for a verification code."
    });
  } catch (error) {
    console.error(`[${requestId}] Organization signup error CRITICAL:`, error);
    // Log stack trace if available
    if (error instanceof Error && error.stack) {
      console.error(`[${requestId}] Stack trace:`, error.stack);
    }
    const errorMessage = error instanceof Error ? error.message : "Failed to create organization";
    res.status(500).json({ error: errorMessage });
  }
});

// Main logout endpoint (GET) - used by the frontend
router.get("/logout", (req: Request, res: Response) => {
  const authReq = req as RequestWithAuth;
  const clearAndRespond = () => {
    res.clearCookie("connect.sid", {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
    });
    res.clearCookie("connect.sid");

    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('text/html') && !acceptHeader.includes('application/json')) {
      res.redirect('/auth');
    } else {
      res.json({ success: true, redirect: "/auth" });
    }
  };

  if (authReq.session) {
    authReq.session.user = undefined;
    authReq.session.userId = undefined;
  }

  if (authReq.logout) {
    authReq.logout(() => {
      authReq.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
        }
        clearAndRespond();
      });
    });
  } else {
    authReq.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
      }
      clearAndRespond();
    });
  }
});

// Google OAuth routes
router.get("/auth/google", (req, res) => {
  try {
    const authUrl = getGoogleAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error("Google auth error:", error);
    const errorMessage = error instanceof Error ? error.message : "Google authentication not configured";
    res.redirect("/auth?error=" + encodeURIComponent(errorMessage));
  }
});

router.get("/auth/google/callback", async (req: Request, res: Response) => {
  try {
    const authReq = req as RequestWithAuth;
    const { code, error } = req.query;

    if (error) {
      return res.redirect("/auth?error=" + encodeURIComponent(error as string));
    }

    if (!code) {
      return res.redirect("/auth?error=No authorization code received");
    }

    const result = await handleGoogleCallback(code as string);

    if (!result.success) {
      return res.redirect("/auth?error=" + encodeURIComponent(result.error || "Authentication failed"));
    }

    const passportUser = {
      id: result.user.id,
      claims: {
        sub: result.user.id,
        email: result.user.email,
        first_name: result.user.firstName,
        last_name: result.user.lastName,
        profile_image_url: result.user.profileImageUrl,
      },
      expires_at: Math.floor(Date.now() / 1000) + (100 * 24 * 60 * 60),
      authProvider: 'google',
    };

    console.log("Google callback - About to login with user:", JSON.stringify(passportUser, null, 2));
    req.login(passportUser, (err) => {
      if (err) {
        console.error("Login error:", err);
        return res.redirect("/auth?error=Login failed");
      }
      console.log("Google callback - Login successful, session:", JSON.stringify(authReq.session?.passport, null, 2));

      authReq.session.save((saveErr) => {
        if (saveErr) {
          console.error("Session save error:", saveErr);
          return res.redirect("/auth?error=Session failed");
        }
        res.redirect("/");
      });
    });
  } catch (error) {
    console.error("Google callback error:", error);
    const errorMessage = error instanceof Error ? error.message : "Authentication failed";
    res.redirect("/auth?error=" + encodeURIComponent(errorMessage));
  }
});

router.post("/auth/forgot-password", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('auth', clientIp, 5, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const result = await createPasswordResetToken(email);

    if (result.success && result.token) {
      const user = await getUserByEmail(email);
      await sendPasswordResetEmail(email, result.token, user?.firstName || 'User');
    }

    res.json({ success: true, message: "If an account exists with this email, you will receive a reset link" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('auth', clientIp, 5, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const result = await resetPassword(token, password);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

router.get("/auth/me", (req: Request, res: Response) => {
  const authReq = req as RequestWithAuth;
  const user = authReq.session?.user;
  if (user) {
    res.json({ user });
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

export default router;
