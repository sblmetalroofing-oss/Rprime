import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { db } from './db';
import { organizations, invoices } from '@shared/schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

interface SubscriptionWithPeriod {
  current_period_end: number;
  status: Stripe.Subscription.Status;
  id: string;
  metadata: Stripe.Metadata;
  items?: {
    data: Array<{
      price: Stripe.Price & { product: string | Stripe.Product };
    }>;
  };
}

interface InvoiceWithSubscription extends Stripe.Invoice {
  subscription: string | Stripe.Subscription | null;
}

function derivePlanFromProduct(productName: string | null, priceMetadata: Stripe.Metadata | null, productMetadata: Stripe.Metadata | null): string {
  const nameToCheck = (productName || '').toLowerCase();
  const priceMetaPlan = priceMetadata?.plan?.toLowerCase() || '';
  const productMetaPlan = productMetadata?.plan?.toLowerCase() || '';
  
  const combined = `${nameToCheck} ${priceMetaPlan} ${productMetaPlan}`;
  
  if (combined.includes('starter') || combined.includes('basic')) {
    return 'starter';
  }
  if (combined.includes('professional') || combined.includes('pro')) {
    return 'professional';
  }
  
  return 'business';
}

function mapSubscriptionStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
      return 'canceled';
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete';
    default:
      return stripeStatus;
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
    
    try {
      const event = JSON.parse(payload.toString()) as Stripe.Event;
      console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);
      
      await WebhookHandlers.handleEvent(event);
    } catch (error) {
      console.error('[Stripe Webhook] Error handling event:', error);
    }
  }
  
  static async handleEvent(event: Stripe.Event): Promise<void> {
    const stripe = await getUncachableStripeClient();
    
    switch (event.type) {
      case 'checkout.session.completed':
        await WebhookHandlers.handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
        break;
        
      case 'customer.subscription.updated':
        await WebhookHandlers.handleSubscriptionUpdated(stripe, event.data.object as Stripe.Subscription);
        break;
        
      case 'customer.subscription.deleted':
        await WebhookHandlers.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
        
      case 'invoice.paid':
        await WebhookHandlers.handleInvoicePaid(stripe, event.data.object as Stripe.Invoice);
        break;
        
      case 'invoice.payment_failed':
        await WebhookHandlers.handleInvoicePaymentFailed(stripe, event.data.object as Stripe.Invoice);
        break;
        
      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  }
  
  static async handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session): Promise<void> {
    console.log(`[Stripe Webhook] Processing checkout.session.completed: ${session.id}`);
    
    if (session.metadata?.type === 'invoice_payment') {
      await WebhookHandlers.handleInvoicePaymentCompleted(session);
      return;
    }
    
    if (session.mode !== 'subscription' || !session.subscription) {
      console.log('[Stripe Webhook] Not a subscription checkout, skipping');
      return;
    }
    
    try {
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['subscription', 'subscription.items.data.price.product']
      });
      
      const subscription = fullSession.subscription as Stripe.Subscription;
      if (!subscription) {
        console.log('[Stripe Webhook] No subscription found in session');
        return;
      }
      
      const organizationId = subscription.metadata?.organizationId || 
                             fullSession.metadata?.organizationId ||
                             session.client_reference_id;
      
      if (!organizationId) {
        console.log('[Stripe Webhook] No organizationId found in metadata, cannot link subscription');
        return;
      }
      
      let plan = 'business';
      const subscriptionItem = subscription.items?.data?.[0];
      if (subscriptionItem) {
        const price = subscriptionItem.price;
        const product = price.product as Stripe.Product;
        plan = derivePlanFromProduct(
          product?.name || null,
          price?.metadata || null,
          product?.metadata || null
        );
      }
      
      const subscriptionData = subscription as unknown as SubscriptionWithPeriod;
      const currentPeriodEnd = new Date(subscriptionData.current_period_end * 1000);
      const status = mapSubscriptionStatus(subscription.status);
      
      await db.update(organizations)
        .set({
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: status,
          subscriptionPlan: plan,
          currentPeriodEnd: currentPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organizationId));
      
      console.log(`[Stripe Webhook] Updated organization ${organizationId}: subscription=${subscription.id}, status=${status}, plan=${plan}`);
    } catch (error: unknown) {
      console.error('[Stripe Webhook] Error handling checkout.session.completed:', error);
    }
  }
  
  static async handleInvoicePaymentCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const invoiceId = session.metadata?.invoiceId;
    const invoiceNumber = session.metadata?.invoiceNumber;
    
    if (!invoiceId) {
      console.log('[Stripe Webhook] No invoiceId in metadata, cannot process invoice payment');
      return;
    }
    
    try {
      const amountPaid = (session.amount_total || 0) / 100;
      
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
      if (!invoice) {
        console.log(`[Stripe Webhook] Invoice ${invoiceId} not found`);
        return;
      }
      
      const totalPaid = (invoice.amountPaid || 0) + amountPaid;
      const isPaid = totalPaid >= (invoice.total || 0);
      
      await db.update(invoices)
        .set({
          amountPaid: totalPaid,
          status: isPaid ? 'paid' : 'partial',
          paidAt: isPaid ? new Date() : invoice.paidAt,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId));
      
      console.log(`[Stripe Webhook] Invoice #${invoiceNumber} payment processed: $${amountPaid}, total paid: $${totalPaid}, status: ${isPaid ? 'paid' : 'partial'}`);
    } catch (error) {
      console.error('[Stripe Webhook] Error processing invoice payment:', error);
    }
  }
  
  static async handleSubscriptionUpdated(stripe: Stripe, subscription: Stripe.Subscription): Promise<void> {
    console.log(`[Stripe Webhook] Processing customer.subscription.updated: ${subscription.id}`);
    
    try {
      const [org] = await db.select()
        .from(organizations)
        .where(eq(organizations.stripeSubscriptionId, subscription.id));
      
      if (!org) {
        console.log(`[Stripe Webhook] No organization found for subscription ${subscription.id}`);
        return;
      }
      
      const fullSubscription = await stripe.subscriptions.retrieve(subscription.id, {
        expand: ['items.data.price.product']
      });
      
      let plan = org.subscriptionPlan || 'business';
      const subscriptionItem = fullSubscription.items?.data?.[0];
      if (subscriptionItem) {
        const price = subscriptionItem.price;
        const product = price.product as Stripe.Product;
        plan = derivePlanFromProduct(
          product?.name || null,
          price?.metadata || null,
          product?.metadata || null
        );
      }
      
      const subscriptionData = fullSubscription as unknown as SubscriptionWithPeriod;
      const currentPeriodEnd = new Date(subscriptionData.current_period_end * 1000);
      const status = mapSubscriptionStatus(fullSubscription.status);
      
      await db.update(organizations)
        .set({
          subscriptionStatus: status,
          subscriptionPlan: plan,
          currentPeriodEnd: currentPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, org.id));
      
      console.log(`[Stripe Webhook] Updated organization ${org.id}: status=${status}, plan=${plan}`);
    } catch (error: unknown) {
      console.error('[Stripe Webhook] Error handling customer.subscription.updated:', error);
    }
  }
  
  static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    console.log(`[Stripe Webhook] Processing customer.subscription.deleted: ${subscription.id}`);
    
    try {
      const [org] = await db.select()
        .from(organizations)
        .where(eq(organizations.stripeSubscriptionId, subscription.id));
      
      if (!org) {
        console.log(`[Stripe Webhook] No organization found for subscription ${subscription.id}`);
        return;
      }
      
      await db.update(organizations)
        .set({
          subscriptionStatus: 'canceled',
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, org.id));
      
      console.log(`[Stripe Webhook] Set organization ${org.id} status to canceled`);
    } catch (error: unknown) {
      console.error('[Stripe Webhook] Error handling customer.subscription.deleted:', error);
    }
  }
  
  static async handleInvoicePaid(stripe: Stripe, invoice: Stripe.Invoice): Promise<void> {
    console.log(`[Stripe Webhook] Processing invoice.paid: ${invoice.id}`);
    
    const invoiceData = invoice as InvoiceWithSubscription;
    const subscriptionId = typeof invoiceData.subscription === 'string' 
      ? invoiceData.subscription 
      : invoiceData.subscription?.id;
    
    if (!subscriptionId) {
      console.log('[Stripe Webhook] Invoice has no subscription, skipping');
      return;
    }
    
    try {
      const [org] = await db.select()
        .from(organizations)
        .where(eq(organizations.stripeSubscriptionId, subscriptionId));
      
      if (!org) {
        console.log(`[Stripe Webhook] No organization found for subscription ${subscriptionId}`);
        return;
      }
      
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const subscriptionData = subscription as unknown as SubscriptionWithPeriod;
      const currentPeriodEnd = new Date(subscriptionData.current_period_end * 1000);
      
      await db.update(organizations)
        .set({
          currentPeriodEnd: currentPeriodEnd,
          subscriptionStatus: mapSubscriptionStatus(subscription.status),
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, org.id));
      
      console.log(`[Stripe Webhook] Updated organization ${org.id} currentPeriodEnd to ${currentPeriodEnd.toISOString()}`);
    } catch (error: unknown) {
      console.error('[Stripe Webhook] Error handling invoice.paid:', error);
    }
  }
  
  static async handleInvoicePaymentFailed(stripe: Stripe, invoice: Stripe.Invoice): Promise<void> {
    console.log(`[Stripe Webhook] Processing invoice.payment_failed: ${invoice.id}`);
    
    const invoiceData = invoice as InvoiceWithSubscription;
    const subscriptionId = typeof invoiceData.subscription === 'string' 
      ? invoiceData.subscription 
      : invoiceData.subscription?.id;
    
    if (!subscriptionId) {
      console.log('[Stripe Webhook] Invoice has no subscription, skipping');
      return;
    }
    
    try {
      const [org] = await db.select()
        .from(organizations)
        .where(eq(organizations.stripeSubscriptionId, subscriptionId));
      
      if (!org) {
        console.log(`[Stripe Webhook] No organization found for subscription ${subscriptionId}`);
        return;
      }
      
      await db.update(organizations)
        .set({
          subscriptionStatus: 'past_due',
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, org.id));
      
      console.log(`[Stripe Webhook] Set organization ${org.id} status to past_due`);
    } catch (error: unknown) {
      console.error('[Stripe Webhook] Error handling invoice.payment_failed:', error);
    }
  }
}
