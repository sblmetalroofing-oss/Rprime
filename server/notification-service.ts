import { storage } from './storage';
import { sendPushNotification } from './push-notifications';

export async function notifyAppointmentCreated(appointment: {
  id: string;
  organizationId: string;
  title: string;
  scheduledDate: string;
  scheduledTime: string | null;
  assignedTo: string[] | null;
  location: string | null;
}) {
  if (!appointment.assignedTo || appointment.assignedTo.length === 0) return;

  const timeStr = appointment.scheduledTime ? ` at ${appointment.scheduledTime}` : '';
  const locationStr = appointment.location ? ` - ${appointment.location}` : '';

  for (const crewMemberId of appointment.assignedTo) {
    try {
      await storage.createNotification({
        organizationId: appointment.organizationId,
        recipientCrewMemberId: crewMemberId,
        type: 'appointment_created',
        title: 'New Appointment',
        message: `You've been assigned to "${appointment.title}" on ${appointment.scheduledDate}${timeStr}${locationStr}`,
        metadata: { appointmentId: appointment.id },
      });
      await sendPushNotification(crewMemberId, 'New Appointment', `You've been assigned to "${appointment.title}" on ${appointment.scheduledDate}${timeStr}${locationStr}`, { url: '/schedule', type: 'appointment_created', appointmentId: appointment.id });
    } catch (error) {
      console.error(`[Notifications] Failed to notify crew member ${crewMemberId}:`, error);
    }
  }
}

export async function notifyAppointmentUpdated(appointment: {
  id: string;
  organizationId: string;
  title: string;
  scheduledDate: string;
  scheduledTime: string | null;
  assignedTo: string[] | null;
  location: string | null;
}, previousAssignedTo: string[] | null) {
  if (!appointment.assignedTo || appointment.assignedTo.length === 0) return;

  const timeStr = appointment.scheduledTime ? ` at ${appointment.scheduledTime}` : '';
  const locationStr = appointment.location ? ` - ${appointment.location}` : '';

  const previousSet = new Set(previousAssignedTo || []);
  const newlyAssigned = appointment.assignedTo.filter(id => !previousSet.has(id));
  const existingAssigned = appointment.assignedTo.filter(id => previousSet.has(id));

  for (const crewMemberId of newlyAssigned) {
    try {
      await storage.createNotification({
        organizationId: appointment.organizationId,
        recipientCrewMemberId: crewMemberId,
        type: 'appointment_created',
        title: 'New Appointment',
        message: `You've been assigned to "${appointment.title}" on ${appointment.scheduledDate}${timeStr}${locationStr}`,
        metadata: { appointmentId: appointment.id },
      });
      await sendPushNotification(crewMemberId, 'New Appointment', `You've been assigned to "${appointment.title}" on ${appointment.scheduledDate}${timeStr}${locationStr}`, { url: '/schedule', type: 'appointment_created', appointmentId: appointment.id });
    } catch (error) {
      console.error(`[Notifications] Failed to notify new crew member ${crewMemberId}:`, error);
    }
  }

  for (const crewMemberId of existingAssigned) {
    try {
      await storage.createNotification({
        organizationId: appointment.organizationId,
        recipientCrewMemberId: crewMemberId,
        type: 'appointment_updated',
        title: 'Appointment Updated',
        message: `"${appointment.title}" has been updated - ${appointment.scheduledDate}${timeStr}${locationStr}`,
        metadata: { appointmentId: appointment.id },
      });
      await sendPushNotification(crewMemberId, 'Appointment Updated', `"${appointment.title}" has been updated - ${appointment.scheduledDate}${timeStr}${locationStr}`, { url: '/schedule', type: 'appointment_updated', appointmentId: appointment.id });
    } catch (error) {
      console.error(`[Notifications] Failed to notify crew member ${crewMemberId}:`, error);
    }
  }
}

const sentReminders = new Set<string>();

function getDateInTimezone(utcDate: Date, timezone: string): Date {
  return new Date(utcDate.toLocaleString('en-US', { timeZone: timezone }));
}

function parseDateTimeInTimezone(dateStr: string, timeStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const aestFormatted = `${dateStr}T${timeStr.padStart(5, '0')}:00`;
  const tempDate = new Date(aestFormatted);
  const tzOffset = getTimezoneOffset(new Date(year, month - 1, day), timezone);
  return new Date(tempDate.getTime() + (tempDate.getTimezoneOffset() * 60000) - (tzOffset * 60000));
}

function getTimezoneOffset(date: Date, timezone: string): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

export async function checkUpcomingAppointmentReminders() {
  try {
    const now = new Date();
    
    const { db } = await import('./db');
    const { appointments, organizations } = await import('@shared/schema');
    const { eq, or, inArray } = await import('drizzle-orm');
    
    const defaultTimezone = 'Australia/Brisbane';
    const nowDefault = getDateInTimezone(now, defaultTimezone);
    const todayStr = `${nowDefault.getFullYear()}-${String(nowDefault.getMonth() + 1).padStart(2, '0')}-${String(nowDefault.getDate()).padStart(2, '0')}`;
    const tomorrowDefault = new Date(nowDefault);
    tomorrowDefault.setDate(tomorrowDefault.getDate() + 1);
    const tomorrowStr = `${tomorrowDefault.getFullYear()}-${String(tomorrowDefault.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDefault.getDate()).padStart(2, '0')}`;
    
    const todayAppointments = await db.select().from(appointments).where(
      or(
        eq(appointments.scheduledDate, todayStr),
        eq(appointments.scheduledDate, tomorrowStr)
      )
    );
    
    if (todayAppointments.length === 0) return;
    
    const orgIds = [...new Set(todayAppointments.map(a => a.organizationId))];
    const orgs = await db.select({ id: organizations.id, timezone: organizations.timezone }).from(organizations).where(inArray(organizations.id, orgIds));
    const orgTimezoneMap = new Map<string, string>();
    for (const org of orgs) {
      orgTimezoneMap.set(org.id, org.timezone || defaultTimezone);
    }
    
    for (const appointment of todayAppointments) {
      if (!appointment.assignedTo || appointment.assignedTo.length === 0) continue;
      if (!appointment.scheduledTime) continue;
      
      const timezone = orgTimezoneMap.get(appointment.organizationId) || defaultTimezone;
      const appointmentDateTime = parseDateTimeInTimezone(appointment.scheduledDate, appointment.scheduledTime, timezone);
      
      const timeDiff = appointmentDateTime.getTime() - now.getTime();
      const minutesUntil = timeDiff / (1000 * 60);
      
      if (minutesUntil > 0 && minutesUntil <= 65) {
        for (const crewMemberId of appointment.assignedTo) {
          const reminderKey = `${appointment.id}-${crewMemberId}-${appointment.scheduledDate}`;
          
          if (sentReminders.has(reminderKey)) continue;
          sentReminders.add(reminderKey);
          
          try {
            const locationStr = appointment.location ? ` at ${appointment.location}` : '';
            await storage.createNotification({
              organizationId: appointment.organizationId,
              recipientCrewMemberId: crewMemberId,
              type: 'appointment_reminder',
              title: 'Upcoming Appointment',
              message: `"${appointment.title}" starts in about ${Math.round(minutesUntil)} minutes${locationStr}`,
              metadata: { appointmentId: appointment.id },
            });
            await sendPushNotification(crewMemberId, 'Upcoming Appointment', `"${appointment.title}" starts in about ${Math.round(minutesUntil)} minutes${locationStr}`, { url: '/schedule', type: 'appointment_reminder', appointmentId: appointment.id });
          } catch (error) {
            console.error(`[Notifications] Failed to send reminder to ${crewMemberId}:`, error);
          }
        }
      }
    }
    
    if (sentReminders.size > 1000) {
      sentReminders.clear();
    }
  } catch (error) {
    console.error('[Notifications] Reminder check failed:', error);
  }
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler() {
  if (reminderInterval) return;
  
  console.log('[Notifications] Starting appointment reminder scheduler (every 5 minutes)');
  
  checkUpcomingAppointmentReminders();
  
  reminderInterval = setInterval(checkUpcomingAppointmentReminders, 5 * 60 * 1000);
}

export function stopReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
