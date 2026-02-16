# Third-Party Integrations Guide

This document covers setup and configuration for all third-party integrations in RPrime.

## Table of Contents

1. [Stripe Payment Processing](#stripe-payment-processing)
2. [Xero Accounting Integration](#xero-accounting-integration)
3. [OpenAI for AI Features](#openai-for-ai-features)
4. [Resend Email Service](#resend-email-service)
5. [Google Cloud Storage](#google-cloud-storage)
6. [Google Authentication](#google-authentication)

---

## Google Authentication

Google Sign-In allows users to log in with their Google accounts.

### Setup Steps

1. **Create Google Cloud Project**
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create a project (or use existing)

2. **Configure OAuth Consent Screen**
   - APIs & Services → OAuth consent screen
   - User Type: **External**
   - Fill in app name, support email, etc.
   - Add scopes: `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`

3. **Create Credentials**
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Name: `RPrime Production`
   - **Authorized redirect URIs**:
     ```
     https://your-app-domain.com/api/auth/google/callback
     ```
     *(Replace `your-app-domain.com` with your actual Vercel domain)*

4. **Environment Variables**
   ```bash
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

### Troubleshooting

**"redirect_uri_mismatch"**
- Ensure the URL in Google Console exactly matches your deployed URL + `/api/auth/google/callback`.
- Don't forget the `https://` protocol.

---


## Stripe Payment Processing

Stripe powers subscription billing and payment processing.

### Setup Steps

1. **Create Stripe Account**
   - Sign up at [stripe.com](https://stripe.com)
   - Complete account verification

2. **Get API Keys**
   - Go to Dashboard → Developers → API Keys
   - Copy "Publishable key" and "Secret key"
   - **Important:** Use test keys for development, live keys for production

3. **Environment Variables**
   ```bash
   STRIPE_SECRET_KEY=sk_test_... # or sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_test_... # or pk_live_...
   STRIPE_WEBHOOK_BASE_URL=https://your-domain.com
   ```

4. **Configure Webhook**
   - Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-domain.com/api/stripe/webhook`
   - Select events:
     * `customer.subscription.created`
     * `customer.subscription.updated`
     * `customer.subscription.deleted`
     * `invoice.payment_succeeded`
     * `invoice.payment_failed`
     * `payment_intent.succeeded`
     * `payment_intent.payment_failed`

5. **Configure Products**
   - Dashboard → Products
   - Create your subscription tiers
   - Copy Product IDs for configuration

### Features Enabled

- Subscription billing
- One-time payments
- Invoice generation
- Payment method management
- Apple Pay / Google Pay (via Payment Request API)
- Automatic payment retry
- Webhook-based synchronization

### Testing

Use Stripe's test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

---

## Xero Accounting Integration

Xero integration enables automatic invoice synchronization and payment tracking.

### Setup Steps

1. **Create Xero Developer Account**
   - Sign up at [developer.xero.com](https://developer.xero.com)
   - Create a new app

2. **Configure OAuth 2.0**
   - App Type: **Web App**
   - Company/App URL: Your website
   - Redirect URI: `https://your-domain.com/api/xero/callback`
   - Scopes Required:
     * `accounting.transactions`
     * `accounting.contacts`
     * `accounting.settings`
     * `offline_access`

3. **Environment Variables**
   ```bash
   XERO_CLIENT_ID=your-client-id
   XERO_CLIENT_SECRET=your-client-secret
   XERO_WEBHOOK_KEY=your-webhook-signing-key
   XERO_REDIRECT_URI=https://your-domain.com/api/xero/callback
   ```

4. **Configure Webhooks** (Optional)
   - Dashboard → Webhooks
   - Payload URL: `https://your-domain.com/api/xero/webhook`
   - Delivery mode: **Queued**
   - Events:
     * `INVOICE`
     * `PAYMENT`

### Features Enabled

- Automatic invoice creation in Xero
- Payment synchronization
- Contact/customer sync
- Invoice status updates
- Account code mapping

### Authorization Flow

1. User clicks "Connect Xero" in settings
2. Redirected to Xero login
3. User authorizes organization access
4. Callback saves tokens for API access

---

## OpenAI for AI Features

OpenAI powers photo analysis, text generation, and intelligent recommendations.

### Setup Steps

1. **Create OpenAI Account**
   - Sign up at [platform.openai.com](https://platform.openai.com)
   - Add payment method (required for API access)

2. **Generate API Key**
   - Dashboard → API Keys
   - Create new secret key
   - Copy immediately (won't be shown again)

3. **Environment Variables**
   ```bash
   AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
   AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
   ```

### Features Enabled

- **Roof Photo Analysis**: Automatically identifies roof damage, materials, and conditions
- **Report Generation**: AI-assisted inspection report creation
- **Recommendation Engine**: Suggests repairs based on findings
- **Chat Support**: Contextual help and guidance

### Models Used

- **Vision Analysis**: `gpt-4-vision-preview` or `gpt-4o`
- **Text Generation**: `gpt-4` or `gpt-3.5-turbo`
- **Embeddings**: `text-embedding-3-small` (if using vector search)

### Cost Management

- Set usage limits in OpenAI Dashboard
- Monitor usage via Dashboard → Usage
- Typical costs:
  * Photo analysis: ~$0.01-0.05 per image
  * Text generation: ~$0.001-0.02 per request

---

## Resend Email Service

Resend handles all transactional emails (notifications, receipts, etc.)

### Setup Steps

1. **Create Resend Account**
   - Sign up at [resend.com](https://resend.com)
   - Verify email address

2. **Add Domain**
   - Dashboard → Domains → Add Domain
   - Add DNS records (SPF, DKIM, DMARC)
   - Verify domain ownership

3. **Generate API Key**
   - Dashboard → API Keys → Create API Key
   - Copy the key

4. **Environment Variables**
   ```bash
   RESEND_API_KEY=re_...
   ```

### Features Enabled

- Invoice emails
- Quote notifications
- Job status updates
- Payment receipts
- Password reset emails
- User invitations
- Custom email templates

### Email Templates

The application uses custom HTML templates for emails. Templates are stored in `server/email.ts`.

### Testing

- Use test mode for development
- Resend Dashboard shows all sent emails
- Check delivery status and opens/clicks

---

## Google Cloud Storage

Google Cloud Storage is optionally used for file uploads (photos, documents, PDFs).

### Setup Steps

1. **Create Google Cloud Project**
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create new project

2. **Enable Cloud Storage API**
   - APIs & Services → Library
   - Search "Cloud Storage"
   - Click "Enable"

3. **Create Storage Bucket**
   - Cloud Storage → Buckets → Create
   - Choose location and storage class
   - Set access control to "Uniform"

4. **Create Service Account**
   - IAM & Admin → Service Accounts → Create
   - Grant "Storage Object Admin" role
   - Create JSON key
   - Download credentials file

5. **Environment Variables**
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   GCS_BUCKET_NAME=your-bucket-name
   ```

   **For Vercel:** Upload the JSON as a secret, then reference it:
   ```bash
   # Set the JSON content as an environment variable
   GCS_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   ```

### Features Enabled

- Photo uploads for inspections
- Document storage (PDFs, contracts)
- Logo and branding assets
- Report attachments
- Automatic CDN distribution

### Alternative: Replit Object Storage

If deploying on Replit, the app can use Replit's built-in object storage instead of GCS.

---

## Security Best Practices

### API Key Management

- **Never** commit API keys to Git
- Use environment variables for all secrets
- Rotate keys regularly (every 90 days recommended)
- Use different keys for development and production
- Monitor API usage for anomalies

### Webhook Security

- Always verify webhook signatures
- Use HTTPS endpoints only
- Implement idempotency for webhook handlers
- Log all webhook events for audit trail

### Rate Limiting

- Implement rate limiting on API endpoints
- Monitor for unusual traffic patterns
- Set up alerts for quota approaching limits

---

## Troubleshooting

### Stripe Issues

**"No such customer"**
- Customer may have been deleted in Stripe
- Re-sync customer data

**Webhook signature verification failed**
- Check webhook secret is correct
- Ensure raw body is being passed to verification

### Xero Issues

**"Token expired"**
- Xero tokens expire after 30 minutes
- App automatically refreshes using refresh token
- If refresh token expired (60 days), user must re-authorize

### OpenAI Issues

**"Rate limit exceeded"**
- Waiting and retrying automatically
- Consider upgrading API tier

**"Model not found"**
- Check model name is correct
- Ensure API key has access to the model

### Resend Issues

**"Domain not verified"**
- Check DNS records are correctly configured
- Wait up to 72 hours for DNS propagation

**Emails going to spam**
- Ensure SPF, DKIM, DMARC are configured
- Warm up sending domain gradually
- Avoid spam trigger words in content

---

## Support Resources

- **Stripe:** [stripe.com/docs](https://stripe.com/docs)
- **Xero:** [developer.xero.com/documentation](https://developer.xero.com/documentation)
- **OpenAI:** [platform.openai.com/docs](https://platform.openai.com/docs)
- **Resend:** [resend.com/docs](https://resend.com/docs)
- **Google Cloud:** [cloud.google.com/storage/docs](https://cloud.google.com/storage/docs)
