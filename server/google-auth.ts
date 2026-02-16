import { OAuth2Client } from 'google-auth-library';
import { db } from './db';
import { users } from '@shared/models/auth';
import { crewMembers } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const getGoogleClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.APP_URL 
    ? `${process.env.APP_URL}/api/auth/google/callback`
    : (process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`
      : 'http://localhost:5000/api/auth/google/callback');

  console.log("Google OAuth Config Debug:");
  console.log("  APP_URL:", process.env.APP_URL);
  console.log("  REPLIT_DEV_DOMAIN:", process.env.REPLIT_DEV_DOMAIN);
  console.log("  Redirect URI:", redirectUri);

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
};

export function getGoogleAuthUrl(): string {
  const client = getGoogleClient();
  
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['profile', 'email'],
    prompt: 'select_account',
    include_granted_scopes: true,
  });
}

interface GoogleAuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  organizationId: string | null;
}

export async function handleGoogleCallback(code: string): Promise<{
  success: boolean;
  user?: GoogleAuthUser;
  error?: string;
  notInCrew?: boolean;
}> {
  try {
    const client = getGoogleClient();
    
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    
    const userInfoResponse = await client.request({
      url: 'https://www.googleapis.com/oauth2/v3/userinfo',
    });
    
    const googleUser = userInfoResponse.data as {
      sub: string;
      email: string;
      email_verified: boolean;
      name: string;
      given_name: string;
      family_name: string;
      picture: string;
    };
    
    const email = googleUser.email.toLowerCase();
    
    const crewMember = await db.select().from(crewMembers)
      .where(sql`lower(${crewMembers.email}) = ${email}`)
      .limit(1);
    
    if (crewMember.length === 0) {
      return { 
        success: false, 
        error: 'Your email is not authorized. Please contact your administrator to be added as a crew member.',
        notInCrew: true
      };
    }
    
    let existingUser = await db.select().from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    
    let user;
    
    if (existingUser.length === 0) {
      const userId = randomUUID();
      await db.insert(users).values({
        id: userId,
        email: email,
        firstName: googleUser.given_name || googleUser.name?.split(' ')[0] || '',
        lastName: googleUser.family_name || googleUser.name?.split(' ').slice(1).join(' ') || '',
        profileImageUrl: googleUser.picture,
        emailVerified: new Date(),
        googleId: googleUser.sub,
        authProvider: 'google',
        organizationId: crewMember[0].organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      await db.update(crewMembers)
        .set({ 
          userId, 
          inviteStatus: 'accepted',
          updatedAt: new Date() 
        })
        .where(eq(crewMembers.id, crewMember[0].id));
      
      user = {
        id: userId,
        email: email,
        firstName: googleUser.given_name || '',
        lastName: googleUser.family_name || '',
        profileImageUrl: googleUser.picture,
        organizationId: crewMember[0].organizationId,
      };
    } else {
      const existingUserData = existingUser[0];
      const needsOrgUpdate = !existingUserData.organizationId && crewMember[0].organizationId;
      
      if (!existingUserData.googleId || needsOrgUpdate) {
        await db.update(users)
          .set({ 
            googleId: googleUser.sub,
            profileImageUrl: googleUser.picture || existingUserData.profileImageUrl,
            ...(needsOrgUpdate ? { organizationId: crewMember[0].organizationId } : {}),
            updatedAt: new Date() 
          })
          .where(eq(users.id, existingUserData.id));
      }
      
      if (crewMember[0].inviteStatus !== 'accepted' || !crewMember[0].userId) {
        await db.update(crewMembers)
          .set({ 
            userId: existingUserData.id, 
            inviteStatus: 'accepted',
            updatedAt: new Date() 
          })
          .where(eq(crewMembers.id, crewMember[0].id));
      }
      
      user = {
        id: existingUserData.id,
        email: existingUserData.email || email,
        firstName: existingUserData.firstName || '',
        lastName: existingUserData.lastName || '',
        profileImageUrl: existingUserData.profileImageUrl,
        organizationId: needsOrgUpdate ? crewMember[0].organizationId : existingUserData.organizationId,
      };
    }
    
    return { success: true, user };
  } catch (error: unknown) {
    console.error('Google OAuth error:', error);
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return { success: false, error: message };
  }
}
