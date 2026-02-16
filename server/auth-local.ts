import bcrypt from 'bcrypt';
import { db } from './db';
import { users, emailVerifications, passwordResets, crewMembers, type CrewMember } from '@shared/schema';
import type { User } from '@shared/models/auth';
import { eq, and, gt, sql } from 'drizzle-orm';
import { getResendClient } from './email';
import { randomUUID } from 'crypto';

const SALT_ROUNDS = 12;
const VERIFICATION_CODE_EXPIRY_MINUTES = 15;
const PASSWORD_RESET_EXPIRY_HOURS = 1;

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createLocalUser(email: string, password: string, firstName: string, lastName: string) {
  const existingUser = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  
  if (existingUser.length > 0) {
    throw new Error('Email already registered');
  }
  
  const passwordHash = await hashPassword(password);
  
  const [user] = await db.insert(users).values({
    email: email.toLowerCase(),
    firstName,
    lastName,
    passwordHash,
    authProvider: 'local',
  }).returning();
  
  return user;
}

export async function createVerificationCode(userId: string, email: string, type: 'verify' | 'reset' = 'verify') {
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);
  
  await db.insert(emailVerifications).values({
    userId,
    email: email.toLowerCase(),
    code,
    type,
    expiresAt,
  });
  
  return code;
}

export async function verifyEmailCode(email: string, code: string): Promise<{ success: boolean; userId?: string; error?: string }> {
  const verifications = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.email, email.toLowerCase()),
        eq(emailVerifications.code, code),
        eq(emailVerifications.type, 'verify'),
        gt(emailVerifications.expiresAt, new Date())
      )
    )
    .limit(1);
  
  if (verifications.length === 0) {
    return { success: false, error: 'Invalid or expired verification code' };
  }
  
  const verification = verifications[0];
  
  await db.update(emailVerifications)
    .set({ usedAt: new Date() })
    .where(eq(emailVerifications.id, verification.id));
  
  await db.update(users)
    .set({ emailVerified: new Date(), updatedAt: new Date() })
    .where(eq(users.id, verification.userId));
  
  return { success: true, userId: verification.userId };
}

export async function sendVerificationEmail(email: string, code: string, firstName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #ec4899, #ef4444); padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">RPrime</h1>
          </div>
          
          <div style="padding: 32px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
              Hi ${firstName},
            </p>
            
            <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
              Your verification code is:
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <div style="display: inline-block; background-color: #f0f0f0; padding: 20px 40px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">
                ${code}
              </div>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 24px;">
              This code expires in ${VERIFICATION_CODE_EXPIRY_MINUTES} minutes.
            </p>
            
            <p style="font-size: 14px; color: #666;">
              If you didn't request this code, you can safely ignore this email.
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
    
    await client.emails.send({
      from: fromEmail,
      to: email,
      subject: 'RPrime - Verify Your Email',
      html: htmlContent,
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: 'Failed to send verification email' };
  }
}

export async function createPasswordResetToken(email: string): Promise<{ success: boolean; token?: string; userId?: string; error?: string }> {
  const userList = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  
  if (userList.length === 0) {
    return { success: false, error: 'Email not found' };
  }
  
  const user = userList[0];
  
  if (user.authProvider !== 'local') {
    return { success: false, error: 'This account uses Replit login' };
  }
  
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000);
  
  await db.insert(passwordResets).values({
    userId: user.id,
    token,
    expiresAt,
  });
  
  return { success: true, token, userId: user.id };
}

export async function verifyPasswordResetToken(token: string): Promise<{ success: boolean; userId?: string; error?: string }> {
  const resets = await db
    .select()
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.token, token),
        gt(passwordResets.expiresAt, new Date())
      )
    )
    .limit(1);
  
  if (resets.length === 0) {
    return { success: false, error: 'Invalid or expired reset link' };
  }
  
  const reset = resets[0];
  
  if (reset.usedAt) {
    return { success: false, error: 'This reset link has already been used' };
  }
  
  return { success: true, userId: reset.userId };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const verification = await verifyPasswordResetToken(token);
  
  if (!verification.success) {
    return verification;
  }
  
  const passwordHash = await hashPassword(newPassword);
  
  await db.update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, verification.userId!));
  
  await db.update(passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(passwordResets.token, token));
  
  return { success: true };
}

export async function sendPasswordResetEmail(email: string, token: string, firstName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const baseUrl = process.env.APP_URL || (process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : '');
    const resetLink = `${baseUrl}/reset-password?token=${token}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background-color: #3e4f61; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">SBL ROOFING</h1>
          </div>
          
          <div style="padding: 32px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
              Hi ${firstName || 'there'},
            </p>
            
            <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
              We received a request to reset your password. Click the button below to set a new password:
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetLink}" style="display: inline-block; background-color: #3e4f61; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 24px;">
              This link expires in ${PASSWORD_RESET_EXPIRY_HOURS} hour(s).
            </p>
            
            <p style="font-size: 14px; color: #666;">
              If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 24px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="font-size: 14px; color: #666; margin: 0;">
              SBL Roofing Pty Ltd
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await client.emails.send({
      from: fromEmail,
      to: email,
      subject: 'SBL Roofing - Reset Your Password',
      html: htmlContent,
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: 'Failed to send password reset email' };
  }
}

export async function authenticateLocal(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  const userList = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  
  if (userList.length === 0) {
    return { success: false, error: 'Invalid email or password' };
  }
  
  const user = userList[0];
  
  if (user.authProvider !== 'local' || !user.passwordHash) {
    return { success: false, error: 'This account uses Replit login' };
  }
  
  const isValid = await verifyPassword(password, user.passwordHash);
  
  if (!isValid) {
    return { success: false, error: 'Invalid email or password' };
  }
  
  if (!user.emailVerified) {
    return { success: false, error: 'Please verify your email first', user };
  }
  
  return { success: true, user };
}

export async function getUserByEmail(email: string) {
  const userList = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return userList[0] || null;
}

// Crew member invite functions
export async function getCrewMemberByEmail(email: string) {
  // Case-insensitive comparison for crew member emails
  const crewList = await db.select().from(crewMembers).where(sql`lower(${crewMembers.email}) = ${email.toLowerCase()}`).limit(1);
  return crewList[0] || null;
}

export async function validateSignupEmail(email: string): Promise<{ valid: boolean; crewMember?: CrewMember; error?: string }> {
  const crewMember = await getCrewMemberByEmail(email);
  
  if (!crewMember) {
    return { valid: false, error: 'This email is not authorized. Please contact your admin to be added as a team member.' };
  }
  
  if (crewMember.inviteStatus === 'accepted') {
    return { valid: false, error: 'This email has already been registered. Try logging in instead.' };
  }
  
  return { valid: true, crewMember };
}

export async function linkUserToCrewMember(userId: string, crewMemberId: string) {
  await db.update(crewMembers)
    .set({ 
      userId, 
      inviteStatus: 'accepted',
      updatedAt: new Date() 
    })
    .where(eq(crewMembers.id, crewMemberId));
}

export async function generateInviteToken(crewMemberId: string): Promise<string> {
  const token = randomUUID();
  
  await db.update(crewMembers)
    .set({ 
      inviteToken: token,
      inviteSentAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(crewMembers.id, crewMemberId));
  
  return token;
}

export async function sendCrewInviteEmail(email: string, name: string, inviteToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const baseUrl = process.env.APP_URL || (process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : '');
    const signupLink = `${baseUrl}/auth?invite=${inviteToken}&email=${encodeURIComponent(email)}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="background-color: #3e4f61; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">SBL ROOFING</h1>
          </div>
          
          <div style="padding: 32px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
              Hi ${name},
            </p>
            
            <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
              You've been invited to join the SBL Roofing team! Click the button below to create your account and get started.
            </p>
            
            <div style="text-align: center; margin: 32px 0;">
              <a href="${signupLink}" style="display: inline-block; background-color: #3e4f61; color: white; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                Accept Invitation
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 24px;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
          
          <div style="background-color: #f5f5f5; padding: 24px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="font-size: 14px; color: #666; margin: 0;">
              SBL Roofing Pty Ltd
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await client.emails.send({
      from: fromEmail,
      to: email,
      subject: "You're invited to join SBL Roofing",
      html: htmlContent,
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error sending crew invite email:', error);
    return { success: false, error: 'Failed to send invitation email' };
  }
}

export async function getCrewMemberByInviteToken(token: string) {
  const crewList = await db.select().from(crewMembers).where(eq(crewMembers.inviteToken, token)).limit(1);
  return crewList[0] || null;
}
