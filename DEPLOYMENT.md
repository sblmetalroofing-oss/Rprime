# RPrime Deployment Guide

This guide covers deploying RPrime to Vercel and other production environments.

## Prerequisites

Before deploying, ensure you have:

- Node.js 20+ installed locally
- A PostgreSQL database (Vercel Postgres, Supabase, or other provider)
- Required API keys and credentials (see Environment Variables section)
- Git repository connected to Vercel (if using GitHub/GitLab integration)

---

## Environment Variables

All environment variables must be configured in your deployment platform. See `.env.example` for the complete list.

### Required Variables

These **must** be set for the application to function:

```bash
DATABASE_URL=postgresql://user:password@host:5432/database_name
SESSION_SECRET=your-secure-random-string-min-32-chars
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
AI_INTEGRATIONS_OPENAI_API_KEY=sk-your_openai_api_key
APP_URL=https://your-app-domain.com
```

### Optional Variables

These enable specific features:

- **Xero Integration**: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_WEBHOOK_KEY`
- **Email Notifications**: `RESEND_API_KEY`
- **Google Cloud Storage**: `GOOGLE_APPLICATION_CREDENTIALS`, `GCS_BUCKET_NAME`
- **Google Authentication**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`


---

## Deploying to Vercel

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Import Your Repository**
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New" → "Project"
   - Import your GitHub/GitLab repository

2. **Configure Build Settings**
   - Framework Preset: **Other**
   - Build Command: `npm run build`
   - Output Directory: `dist/public`
   - Install Command: `npm install`
   - Node.js Version: **20.x**

3. **Add Environment Variables**
   - In the project settings, go to "Environment Variables"
   - Add all required variables from the `.env.example` file
   - Make sure to set `NODE_ENV=production`

4. **Deploy**
   - Click "Deploy"
   - Wait for the build to complete (typically 2-5 minutes)

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to preview environment
vercel

# Deploy to production
vercel --prod
```

---

## Database Setup

### 1. Provision PostgreSQL Database

Choose one of these options:

#### Vercel Postgres (Recommended for Vercel)
```bash
vercel postgres create
```

#### Supabase
1. Create a new project at [supabase.com](https://supabase.com)
2. Get the connection string from Project Settings → Database
3. Use the "Pooler" connection string for better performance

#### Other Providers
- Neon, Railway, Render, or any PostgreSQL provider
- Ensure SSL is enabled for production databases

### 2. Push Database Schema

After setting `DATABASE_URL`:

```bash
npm run db:push
```

This will create all necessary tables and relationships.

### 3. Seed Initial Data (Optional)

The application automatically seeds document themes on first startup. Additional seeding can be done through the admin interface.

---

## Post-Deployment Setup

### 1. Test Health Endpoint

Verify the deployment is working:

```bash
curl https://your-app-domain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-16T00:00:00.000Z",
  "uptime": 123.45,
  "environment": "production"
}
```

### 2. Configure Stripe Webhooks

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Endpoint URL: `https://your-app-domain.com/api/stripe/webhook`
4. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the webhook signing secret
6. Add it to Vercel environment variables as `STRIPE_WEBHOOK_SECRET` (if needed)

### 3. Configure Xero OAuth (If Using Xero)

1. Create an app at [Xero Developer Portal](https://developer.xero.com)
2. Set redirect URI: `https://your-app-domain.com/api/xero/callback`
3. Copy Client ID and Secret to environment variables
4. Configure webhook in Xero Dashboard pointing to: `https://your-app-domain.com/api/xero/webhook`

### 4. Test Email Sending

Verify Resend integration:
- Trigger a test email through the application
- Check [Resend Dashboard](https://resend.com/emails) for delivery status

---

## Monitoring and Debugging

### View Logs

**Vercel Dashboard:**
- Go to your project → Deployments → [Latest Deployment] → Functions
- Click on any function execution to see logs

**Vercel CLI:**
```bash
vercel logs [deployment-url]
```

### Common Issues

#### Build Fails

**Error:** `DATABASE_URL must be set`
- **Solution:** Database URL is required even for build time. Add it to Vercel environment variables.

**Error:** `Module not found`
- **Solution:** Ensure `package.json` dependencies are correct. Try `npm install` locally first.

#### Database Connection Errors

**Error:** `Connection timeout`
- **Solution:** Check if database allows connections from Vercel IPs. Most providers require whitelisting `0.0.0.0/0` or Vercel's IP ranges.

**Error:** `SSL/TLS error`
- **Solution:** Ensure `ssl: { rejectUnauthorized: false }` in pool config (already configured in `db.ts`).

#### Function Timeout

**Error:** `Function execution timed out`
- **Solution:** Vercel free tier has 10s timeout. Pro tier has 60s. Optimize long-running operations or move to background jobs.

### Performance Optimization

1. **Enable Connection Pooling:** ✅ Already configured in `db.ts`
2. **Use CDN for Assets:** Vercel automatically handles this
3. **Database Indexes:** Review slow queries and add indexes as needed
4. **Caching:** API responses have caching headers already configured

---

## Updating the Application

### Zero-Downtime Deployments

Vercel automatically handles zero-downtime deployments:

1. Push changes to your Git repository
2. Vercel builds the new version
3. Once ready, traffic is atomically switched to new version
4. Old version remains available for instant rollback

### Rollback

If something goes wrong:

1. Go to Vercel Dashboard → Deployments
2. Find a previous working deployment
3. Click "Promote to Production"

---

## Security Checklist

- [ ] All environment variables are set in Vercel (not committed to Git)
- [ ] `SESSION_SECRET` is a strong random string (min 32 characters)
- [ ] Stripe uses live keys (not test keys) in production
- [ ] Database has SSL enabled
- [ ] Stripe webhook signature is verified
- [ ] CORS is configured for your domain only
- [ ] Rate limiting is enabled on sensitive endpoints
- [ ] API keys are rotated regularly

---

## Scaling Considerations

### Database

- Monitor connection pool usage
- Consider increasing pool size if needed (currently set to 20)
- Use read replicas for heavy read workloads
- Implement database connection pooling via PgBouncer for very high traffic

### Application

- Vercel automatically scales based on traffic
- Monitor function execution times
- Move long-running jobs to background workers if needed
- Consider implementing queue system for heavy async operations

---

## Backup and Disaster Recovery

### Database Backups

- **Vercel Postgres:** Automatic daily backups included
- **Supabase:** Automatic backups with point-in-time recovery
- **Manual Backups:** Use `pg_dump` for critical data

```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Environment Variables Backup

Export environment variables from Vercel:

```bash
vercel env pull .env.production
```

Store this securely (encrypted) for disaster recovery.

---

## Support

For issues or questions:

1. Check application logs in Vercel Dashboard
2. Review this documentation
3. Check database connection and credentials
4. Verify all API keys are valid and have correct permissions
