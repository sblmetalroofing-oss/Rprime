import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { organizations, crewMembers, users } from "@shared/schema";
import { canRoleDelete } from "@shared/roles";
import { getCrewMemberByEmail } from "../auth-local";

export interface SessionUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
}

export interface PassportUserClaims {
  sub?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

export interface PassportUser {
  id?: string;
  email?: string;
  claims?: PassportUserClaims;
}

export interface AuthenticatedRequest extends Omit<Request, 'session'> {
  session: (Request['session'] & {
    user?: SessionUser;
  }) | undefined;
  user?: PassportUser;
  organizationId?: string;
}

export async function getOrganizationId(req: AuthenticatedRequest): Promise<string | null> {
  if (req.session?.user?.organizationId) {
    return req.session.user.organizationId;
  }
  
  const userId = req.session?.user?.id || 
                 req.user?.claims?.sub || 
                 req.user?.id;
  
  if (!userId) {
    return null;
  }
  
  const user = await storage.getUser(userId);
  const organizationId = user?.organizationId || null;
  
  if (organizationId && req.session?.user) {
    req.session.user.organizationId = organizationId;
  }
  
  return organizationId;
}

export async function canUserDelete(req: AuthenticatedRequest): Promise<boolean> {
  const userEmail = req.session?.user?.email || req.user?.email || req.user?.claims?.email;
  const userId = req.session?.user?.id || req.user?.claims?.sub || req.user?.id;
  
  if (userId) {
    const dbUser = await storage.getUser(userId);
    if (dbUser?.organizationId) {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, dbUser.organizationId));
      if (org?.ownerId === userId) return true;
    }
  }
  
  if (!userEmail) return false;
  
  const crewMember = await getCrewMemberByEmail(userEmail);
  if (!crewMember || crewMember.isActive !== 'true') return false;
  
  return canRoleDelete(crewMember.role);
}

export async function getUserAttribution(req: AuthenticatedRequest, organizationId: string): Promise<{ id: string | null, name: string }> {
  const sessionUser = req.session?.user;
  const passportUser = req.user;
  
  const userEmail = sessionUser?.email || passportUser?.claims?.email || passportUser?.email;
  const claims = passportUser?.claims || {};
  const firstName = sessionUser?.firstName || claims.first_name || '';
  const lastName = sessionUser?.lastName || claims.last_name || '';
  
  if (userEmail) {
    const crewMembersList = await storage.getAllCrewMembers(organizationId);
    const matchingCrewMember = crewMembersList.find(m => 
      m.email && userEmail && 
      m.email.toLowerCase() === userEmail.toLowerCase()
    );
    
    if (matchingCrewMember) {
      return { id: matchingCrewMember.id, name: matchingCrewMember.name };
    }
  }
  
  const displayName = firstName && lastName 
    ? `${firstName} ${lastName}` 
    : firstName 
    || userEmail?.split('@')[0] 
    || 'Team Member';
  
  return { id: userEmail || null, name: displayName };
}

export async function tryLinkOrphanUser(userId: string, userEmail: string): Promise<{ organizationId: string | null; linked: boolean }> {
  try {
    if (!userId || !userEmail) {
      return { organizationId: null, linked: false };
    }
    
    const [existingUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (existingUser?.organizationId) {
      return { organizationId: existingUser.organizationId, linked: false };
    }
    
    const [crewMember] = await db.select().from(crewMembers)
      .where(sql`lower(${crewMembers.email}) = ${userEmail.toLowerCase()}`)
      .limit(1);
    
    if (crewMember?.organizationId) {
      await db.update(users)
        .set({ organizationId: crewMember.organizationId, updatedAt: new Date() })
        .where(eq(users.id, userId));
      
      if (!crewMember.userId || crewMember.userId !== userId) {
        await db.update(crewMembers)
          .set({ 
            userId: userId, 
            inviteStatus: 'accepted',
            updatedAt: new Date() 
          })
          .where(eq(crewMembers.id, crewMember.id));
      }
      
      console.log(`Auto-linked orphan user ${userEmail} to organization ${crewMember.organizationId}`);
      return { organizationId: crewMember.organizationId, linked: true };
    }
    
    return { organizationId: null, linked: false };
  } catch (error) {
    console.error("Error in tryLinkOrphanUser:", error);
    return { organizationId: null, linked: false };
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.session?.user?.id || 
                 authReq.user?.claims?.sub || 
                 authReq.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

export async function requireOrganization(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  const organizationId = await getOrganizationId(authReq);
  if (!organizationId) {
    return res.status(401).json({ error: "Not authenticated or no organization" });
  }
  authReq.organizationId = organizationId;
  next();
}

export async function requireDeletePermission(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  if (!await canUserDelete(authReq)) {
    return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
  }
  next();
}
