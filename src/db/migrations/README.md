# Database Migrations

This folder contains SQL migration files for the Client Approval + Payment Portal.

## Migration Files

- `001_initial_schema.sql` - Initial database schema with all tables, enums, indexes, and triggers

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended for beginners)

1. Log in to your Supabase project at https://supabase.com
2. Navigate to the **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of the migration file (e.g., `001_initial_schema.sql`)
5. Paste into the SQL editor
6. Click **Run** to execute the migration

### Option 2: Using psql (Command Line)

If you have direct database access:

```bash
# Get your database connection string from Supabase Dashboard
# Settings > Database > Connection string (Direct connection)

psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f src/db/migrations/001_initial_schema.sql
```

### Option 3: Supabase CLI (Advanced)

If you have Supabase CLI installed:

```bash
# Initialize Supabase in your project
supabase init

# Link to your remote project
supabase link --project-ref [YOUR-PROJECT-REF]

# Apply migration
supabase db push
```

## Migration Order

Migrations should be run in numerical order:
1. `001_initial_schema.sql`
2. (Future migrations will be added here)

## Verification

After running migrations, verify the schema:

```sql
-- Check tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check enums
SELECT typname
FROM pg_type
WHERE typtype = 'e'
ORDER BY typname;
```

## Rollback

To rollback changes, you would need to create a down migration. For now, you can drop the entire schema:

```sql
-- WARNING: This will delete all data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```
