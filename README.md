# RPrime - Job Management Platform

A full-stack job management and inspection platform for trades businesses (roofing, plumbing, electrical).

## Features

- 📋 Job management and scheduling
- 🏠 Roof inspection reports with AI photo analysis
- 💰 Quotes and invoices with customer accept/decline
- 📦 Purchase order tracking
- 👥 Customer relationship management (CRM)
- 👷 Crew management with mobile dashboard
- 💳 Stripe payment processing (including Apple Pay)
- 🧾 Xero accounting integration
- 📧 Email notifications via Resend
- 🏢 Multi-tenant architecture with subscription billing

## Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Auth:** OpenID Connect (Replit Auth) or Local Auth
- **APIs:** Stripe, OpenAI, Resend, Xero
- **Storage:** Google Cloud Storage (optional)

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Required API keys (see [INTEGRATIONS.md](./INTEGRATIONS.md))

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables template
cp .env.example .env

# Edit .env with your database URL and API keys
# Required: DATABASE_URL, SESSION_SECRET, STRIPE keys, OPENAI key

# Push database schema
npm run db:push
```

### Development

```bash
# Run development server
npm run dev

# The app will be available at http://localhost:5000
```

### Building for Production

```bash
# Build client and server
npm run build

# Start production server
npm start
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions for Vercel and other platforms.

Quick deploy to Vercel:

```bash
vercel
```

## Environment Variables

See [.env.example](./.env.example) for all required and optional environment variables.

### Required Variables

- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key
- `APP_URL` - Base URL of your application

## Integrations

Detailed setup guides for integrations:

- [Stripe Payment Processing](./INTEGRATIONS.md#stripe-payment-processing)
- [Xero Accounting](./INTEGRATIONS.md#xero-accounting-integration)
- [OpenAI AI Features](./INTEGRATIONS.md#openai-for-ai-features)
- [Resend Email](./INTEGRATIONS.md#resend-email-service)
- [Google Cloud Storage](./INTEGRATIONS.md#google-cloud-storage)

## Scripts

```bash
# Development
npm run dev              # Start development server
npm run dev:client       # Start only Vite dev server

# Building
npm run build            # Build for production
npm run check            # TypeScript type check

# Database
npm run db:push          # Push schema changes to database

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting

# Production
npm start                # Start production server
```

## Project Structure

```
rprime/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utility libraries
│   │   └── App.tsx      # Main app component
│   └── index.html       # HTML template
├── server/              # Express backend
│   ├── routes/          # API route handlers
│   ├── db.ts            # Database connection
│   ├── logger.ts        # Logging utility
│   └── index.ts         # Server entry point
├── shared/              # Shared types and schemas
│   └── schema.ts        # Drizzle database schema
├── script/              # Build scripts
└── dist/                # Production build output
```

## License

MIT

## Support

For deployment issues, see [DEPLOYMENT.md](./DEPLOYMENT.md).
For integration setup, see [INTEGRATIONS.md](./INTEGRATIONS.md).
