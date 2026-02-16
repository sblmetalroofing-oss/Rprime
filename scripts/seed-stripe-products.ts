import { getUncachableStripeClient } from '../server/stripeClient';

async function seedProducts() {
  console.log('Seeding Stripe products for RPrime subscriptions...');
  
  const stripe = await getUncachableStripeClient();
  
  const existingProducts = await stripe.products.search({ query: "name:'RPrime'" });
  if (existingProducts.data.length > 0) {
    console.log('RPrime products already exist, skipping seed.');
    console.log('Existing products:', existingProducts.data.map(p => ({ id: p.id, name: p.name })));
    return;
  }
  
  console.log('Creating Starter plan...');
  const starterProduct = await stripe.products.create({
    name: 'RPrime Starter',
    description: 'Perfect for small trades just getting started. Manage jobs, quotes, and invoices for your crew.',
    metadata: {
      plan_type: 'starter',
      max_crew: '3',
      features: 'jobs,quotes,invoices,customers,reports',
    },
  });
  
  const starterMonthly = await stripe.prices.create({
    product: starterProduct.id,
    unit_amount: 2900,
    currency: 'aud',
    recurring: { interval: 'month' },
    metadata: { billing_period: 'monthly' },
  });
  
  console.log(`Created Starter plan: ${starterProduct.id}, Monthly price: ${starterMonthly.id}`);
  
  console.log('Creating Professional plan...');
  const proProduct = await stripe.products.create({
    name: 'RPrime Professional',
    description: 'For growing businesses. All Starter features plus advanced scheduling, purchase orders, and lead pipeline.',
    metadata: {
      plan_type: 'professional',
      max_crew: '10',
      features: 'jobs,quotes,invoices,customers,reports,scheduling,purchase_orders,leads,products',
    },
  });
  
  const proMonthly = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 5900,
    currency: 'aud',
    recurring: { interval: 'month' },
    metadata: { billing_period: 'monthly' },
  });
  
  console.log(`Created Professional plan: ${proProduct.id}, Monthly price: ${proMonthly.id}`);
  
  console.log('Creating Business plan...');
  const businessProduct = await stripe.products.create({
    name: 'RPrime Business',
    description: 'Full-featured solution for established businesses. Unlimited crew, team chat, custom branding, and priority support.',
    metadata: {
      plan_type: 'business',
      max_crew: 'unlimited',
      features: 'jobs,quotes,invoices,customers,reports,scheduling,purchase_orders,leads,products,chat,branding,api',
    },
  });
  
  const businessMonthly = await stripe.prices.create({
    product: businessProduct.id,
    unit_amount: 9900,
    currency: 'aud',
    recurring: { interval: 'month' },
    metadata: { billing_period: 'monthly' },
  });
  
  console.log(`Created Business plan: ${businessProduct.id}, Monthly price: ${businessMonthly.id}`);
  
  console.log('\n✅ Stripe products seeded successfully!');
  console.log('\nProducts created:');
  console.log(`  Starter: ${starterProduct.id} - $29/month (${starterMonthly.id})`);
  console.log(`  Professional: ${proProduct.id} - $59/month (${proMonthly.id})`);
  console.log(`  Business: ${businessProduct.id} - $99/month (${businessMonthly.id})`);
}

seedProducts().catch(console.error);
