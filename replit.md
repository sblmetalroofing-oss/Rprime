# RPrime - Job Management Platform for Trades

## Overview

RPrime is a comprehensive job management platform designed for trades businesses (e.g., roofing, plumbing, electrical). It streamlines operations such as roof inspection reports, job scheduling, quote/invoice generation, purchase order tracking, and customer relationship management. The platform aims to be a user-friendly, all-in-one solution, similar to Tradify.

Key capabilities include a dynamic dashboard, detailed job and report management, versatile scheduling, robust financial tools (quotes, invoices), product catalog, CRM, and supplier management. Advanced features like AI Photo Analysis for roof damage and a Lead Pipeline CRM are integrated to optimize business processes. RPrime supports a multi-tenant architecture with subscription billing via Stripe (Starter, Professional, Business plans, 14-day free trial) and is accessible on both desktop and mobile, with a PWA for offline support.

## User Preferences

Preferred communication style: Simple, everyday language.
Goal: Building something similar to Tradify - a simple job management system for tradespeople. Keep it streamlined for staff to use daily without complexity.

## System Architecture

RPrime is a full-stack TypeScript application featuring a React frontend and an Express backend.

### Frontend Architecture
- **Framework**: React 18 with TypeScript.
- **Routing**: Wouter.
- **State Management**: TanStack React Query for server state, React hooks for local state.
- **UI Components**: Shadcn/ui, built on Radix UI primitives.
- **Styling**: Tailwind CSS v4 with CSS variables.
- **Build Tool**: Vite.

### Backend Architecture
- **Runtime**: Node.js with Express.
- **Language**: TypeScript.
- **API Design**: RESTful endpoints.
- **Session Management**: Express sessions with PostgreSQL store.
- **Authentication**: Replit Auth using OpenID Connect.

### Data Storage
- **Database**: PostgreSQL, managed with Drizzle ORM.
- **Schema**: Defined in `shared/schema.ts` for type safety.
- **Key Entities**: Users, sessions, customers, reports, jobs, quotes, invoices, purchase orders, crew members, appointments, leads, and associated line items and activity logs.

### Key Design Patterns & Features
- **Shared Schema**: Centralized database schema for type safety across frontend and backend.
- **Multi-Tenant Security**: All data operations are scoped by `organizationId` to ensure data isolation. Storage methods enforce org scoping at the data layer (defense-in-depth), including sub-resources like job activities, invoice payments, checklists, crew schedule, lead reminders, and feedback events.
- **Server-Side Financial Validation**: Quote and invoice totals (subtotal, GST, total) are always recalculated server-side from line items, preventing client-side price manipulation. Empty items force totals to zero.
- **State Transition Guards**: Quote and invoice status changes follow defined lifecycle rules (e.g., accepted quotes can't revert to draft, paid/void invoices reject new payments). Public quote accept is idempotent.
- **Input Validation**: All create/update routes use Zod schema validation (drizzle-zod insert schemas or inline z.object) to reject malformed data before it reaches storage.
- **Role-Based Permissions**: Crew members have `tradesperson` or `manager` roles, with an `isAdmin` flag, controlling access (e.g., delete permissions).
- **Authentication & User Linking**: Prevents orphan users by linking authenticated users to crew member records by email; handles case-insensitivity.
- **Multi-Quote Invoice Handling**: Invoices can be linked to specific quotes on multi-quote jobs, supporting deposit, progress, and final invoice types with chain summary.
- **Lead Conversion Pipeline**: Facilitates converting leads into quotes and jobs, copying relevant details and attachments.
- **RFlash Security (Flashing Profile Designer)**: Flashing orders and templates are organization-scoped, profiles are child resources. All CRUD routes use Zod validation.
- **Cross-Window Photo Drag & Drop**: Enables dragging photos between browser windows for attachment to reports, quotes, invoices, and POs.
- **In-App Crew Notifications**: Database-backed notifications for appointments (created, updated, reminders), with frontend polling and web push notifications.
- **Public Document Actions**: Secure public links for customers to accept/decline quotes and make online payments for invoices via Stripe Checkout.
- **Code Splitting**: All page components use React.lazy() with Suspense for on-demand loading, reducing initial bundle size. Only AuthPage, NotFound, and Unauthorized are eagerly loaded.
- **Database Indexes**: Comprehensive indexes on organizationId, foreign keys (jobId, customerId, channelId, etc.), status fields, and composite indexes for common query patterns across all major tables including chat.
- **Bulk Delete Operations**: deleteJob uses SQL subqueries with inArray for bulk cascade deletes instead of N+1 loops.
- **Chat Unread Optimization**: Unread counts use per-channel SQL COUNT queries with channelReadStatus tracking, and DM unreads use SQL COUNT instead of fetching all rows.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.
- **Drizzle ORM**: For type-safe database interactions.

### Authentication
- **Replit Auth**: OpenID Connect for user authentication.

### Frontend Libraries
- **jsPDF & html2canvas**: For PDF generation.
- **@dnd-kit**: For drag-and-drop functionalities.
- **date-fns**: For date manipulation.
- **Radix UI**: Provides accessible UI primitives.

### Integrations
- **Stripe**: For subscription billing and customer invoice payments (Stripe Checkout).
- **Resend**: For email delivery.
- **Xero**: Accounting software integration for invoice syncing and webhook-based payment updates.
- **OpenAI GPT-4o**: For AI Photo Analysis in roof inspection reports via Replit AI Integrations.

### Build & Development
- **Vite**: Frontend build tool.
- **esbuild**: Server bundling.
- **Replit Vite Plugins**: Enhances development experience within Replit.

### iOS App (Capacitor)
- **Capacitor**: For building a native iOS app.
- **Capacitor Plugins**: Core, iOS, SplashScreen, StatusBar, Keyboard, PushNotifications, Camera, Haptics, App.