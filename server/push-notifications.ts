import webpush from "web-push";
import { storage } from "./storage";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@sblroofing.com.au";

let vapidConfigured = false;

export function configureVapid() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("VAPID keys not configured. Push notifications disabled.");
    console.log("Generate keys with: npx web-push generate-vapid-keys");
    return false;
  }
  
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
    console.log("Push notifications configured");
    return true;
  } catch (error) {
    console.error("Failed to configure VAPID:", error);
    return false;
  }
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export function isPushEnabled(): boolean {
  return vapidConfigured;
}

export async function sendPushNotification(
  crewMemberId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (!vapidConfigured) {
    return;
  }

  try {
    const subscriptions = await storage.getPushSubscriptions(crewMemberId);
    
    const payload = JSON.stringify({
      title,
      body,
      data: {
        ...data,
        timestamp: Date.now()
      }
    });

    const sendPromises = subscriptions.map(async (sub) => {
      if (sub.endpoint.startsWith('apns://') || sub.endpoint.startsWith('fcm://')) {
        console.log(`[Push] Skipping native endpoint for crew ${crewMemberId}: ${sub.endpoint.substring(0, 20)}...`);
        return;
      }
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
      } catch (error: unknown) {
        const webPushError = error as { statusCode?: number };
        if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
          await storage.deletePushSubscription(sub.id);
        } else {
          console.error("Push notification failed:", error);
        }
      }
    });

    await Promise.all(sendPromises);
  } catch (error) {
    console.error("Error sending push notifications:", error);
  }
}

export async function sendPushToAll(
  excludeCrewMemberId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (!vapidConfigured) {
    return;
  }

  try {
    const allSubscriptions = await storage.getAllPushSubscriptions();
    const subscriptions = allSubscriptions.filter(s => s.crewMemberId !== excludeCrewMemberId);
    
    const payload = JSON.stringify({
      title,
      body,
      data: {
        ...data,
        timestamp: Date.now()
      }
    });

    const sendPromises = subscriptions.map(async (sub) => {
      if (sub.endpoint.startsWith('apns://') || sub.endpoint.startsWith('fcm://')) {
        console.log(`[Push] Skipping native endpoint for crew ${sub.crewMemberId}: ${sub.endpoint.substring(0, 20)}...`);
        return;
      }
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
      } catch (error: unknown) {
        const webPushError = error as { statusCode?: number };
        if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
          await storage.deletePushSubscription(sub.id);
        }
      }
    });

    await Promise.all(sendPromises);
  } catch (error) {
    console.error("Error sending push notifications:", error);
  }
}
