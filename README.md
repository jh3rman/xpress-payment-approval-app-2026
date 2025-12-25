# Client Approval + Payment Portal

A production-grade web application for managing client approvals and payments. Built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Phase 0 - Complete

This repository contains the scaffolding and foundation for the Client Approval + Payment Portal:

- ✅ Next.js 14+ App Router with TypeScript
- ✅ Tailwind CSS styling system
- ✅ Supabase integration (Database + Storage ready)
- ✅ Complete database schema with migrations
- ✅ Settings admin page with full CRUD functionality
- ✅ Admin layout and navigation

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (for file uploads in future phases)
- **ORM**: Supabase JS Client

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 18+ and npm
- A Supabase account and project

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd xpress-payment-approval-app-2026
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
# Server-side only (for service role operations)
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_STORAGE_BUCKET=payment-portal-files

# Client-side (publicly exposed)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Where to find these values:**

1. Log in to [Supabase](https://supabase.com)
2. Go to your project
3. Navigate to **Settings** > **API**
4. Copy:
   - `Project URL` → `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Run Database Migrations

You need to run the SQL migrations to set up your database schema. Choose one of the following methods:

#### Option 1: Supabase Dashboard (Recommended for beginners)

1. Open your Supabase project dashboard
2. Go to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open `src/db/migrations/001_initial_schema.sql` in your code editor
5. Copy the entire contents
6. Paste into the Supabase SQL Editor
7. Click **Run** to execute

#### Option 2: Using psql (Command Line)

If you have PostgreSQL `psql` installed:

```bash
# Get your database connection string from Supabase Dashboard
# Settings > Database > Connection string (Direct connection)

psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f src/db/migrations/001_initial_schema.sql
```

See `src/db/migrations/README.md` for more migration options.

### 5. Create Storage Bucket (For Future Phases)

In your Supabase project:

1. Go to **Storage** in the left sidebar
2. Click **Create a new bucket**
3. Name it: `payment-portal-files`
4. Make it **Private** (not public)
5. Click **Create bucket**

> Note: File storage will be used in Phase 1+ for invoices and artwork uploads.

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
xpress-payment-approval-app-2026/
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── admin/               # Admin pages
│   │   │   ├── layout.tsx       # Admin layout with navigation
│   │   │   ├── settings/        # Settings CRUD page
│   │   │   └── orders/          # Orders page (placeholder)
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Home page
│   │   └── globals.css          # Global styles
│   ├── components/              # Reusable React components
│   ├── lib/                     # Utilities and helpers
│   │   ├── supabase/
│   │   │   ├── server.ts        # Server-side Supabase client
│   │   │   └── client.ts        # Client-side Supabase client
│   │   └── types/
│   │       └── database.ts      # TypeScript database types
│   └── db/
│       └── migrations/          # SQL migration files
│           ├── 001_initial_schema.sql
│           └── README.md
├── public/                      # Static assets
├── .env.example                 # Example environment variables
├── next.config.ts               # Next.js configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Dependencies and scripts
```

## Key Features (Phase 0)

### Settings Management

Navigate to `/admin/settings` to configure:

- **Company Profile**: Name, contact info, address, hours, website
- **Email Defaults**: From email, admin notification email
- **Tipping Configuration**: Fixed dollar amounts or percentage-based tips
- **Reminders & Auto-Cancellation**: Configure reminder schedules and auto-cancel timing
- **Placeholders**: Notification toggles and email templates (for future phases)

### Database Schema

The complete database schema includes:

**Tables:**
- `settings` - Global application settings (singleton)
- `orders` - Customer orders with approval workflow
- `order_files` - File attachments (invoices, artwork)
- `approvals` - Approval status tracking
- `messages` - Chat between customer and admin
- `email_attempts` - Email delivery tracking
- `activity_log` - Audit log for all activities

**Enums:**
- `order_status`, `approval_status`, `sender_role`, `email_type`, `email_status`, `file_type`, `tip_mode`

See `src/db/migrations/001_initial_schema.sql` for full schema details.

## Important Security Notes

### Supabase Client Separation

This project uses two separate Supabase clients:

1. **Server Client** (`src/lib/supabase/server.ts`):
   - Uses `SUPABASE_SERVICE_ROLE_KEY`
   - Bypasses Row Level Security (RLS)
   - **Server-only** - protected against client-side imports
   - Use in Server Components, API Routes, and Server Actions

2. **Browser Client** (`src/lib/supabase/client.ts`):
   - Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Respects Row Level Security (RLS)
   - Safe for client-side use
   - Use in Client Components

### Environment Variables

- **Server-only variables** (not prefixed with `NEXT_PUBLIC_`):
  - `SUPABASE_SERVICE_ROLE_KEY` - Never exposed to the browser
  - `SUPABASE_URL` - Used server-side

- **Public variables** (prefixed with `NEXT_PUBLIC_`):
  - `NEXT_PUBLIC_SUPABASE_URL` - Safe to expose
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Safe to expose (respects RLS)

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

## Manual Test Checklist

Before proceeding to Phase 1, verify the following:

- [ ] Development server starts without errors (`npm run dev`)
- [ ] Database migrations applied successfully
- [ ] Navigate to `/admin/settings`
- [ ] Settings page loads and creates default row if empty
- [ ] Edit company profile fields and save
- [ ] Edit email defaults and save
- [ ] Change tip mode between fixed/percent
- [ ] Edit tip presets (test comma-separated values)
- [ ] Edit reminder days and auto-cancel days
- [ ] Refresh page and confirm all changes persisted
- [ ] Navigate to `/admin/orders` and see placeholder message
- [ ] Confirm service role key is NOT in client bundle:
  ```bash
  npm run build
  # Search build output for service role key - should not appear in client bundles
  ```

## Troubleshooting

### "Missing Supabase environment variables" Error

- Ensure `.env` file exists and contains all required variables
- Restart the development server after adding environment variables
- Check that variable names match exactly (case-sensitive)

### Database Connection Errors

- Verify Supabase project is active
- Check that connection credentials are correct
- Ensure migrations have been run

### Settings Page Shows "Error Loading Settings"

- Confirm migrations were run successfully
- Check browser console for detailed error messages
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly

## Next Steps

Phase 0 is complete! The following features will be implemented in future phases:

**Phase 1:**
- Orders CRUD interface
- File upload (invoices/artwork) to Supabase Storage
- Customer-facing approval page (matching Square UI design)
- Real-time chat between customer and admin

**Phase 2+:**
- Email sending (initial, reminders, notifications)
- Payment integration
- Automated reminder system
- Webhooks for email events
- Analytics and reporting

## Contributing

This is a production application. Please follow these guidelines:

- Write clear, descriptive commit messages
- Test thoroughly before committing
- Follow the existing code style and structure
- Update documentation when adding features

## License

Proprietary - All rights reserved
