import { createClient } from '@supabase/supabase-js';

// Guard against client-side imports
if (typeof window !== 'undefined') {
  throw new Error(
    '❌ supabase/server.ts cannot be imported on the client side. ' +
    'This module uses the service role key and must only run on the server.'
  );
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
  );
}

/**
 * Server-side Supabase client with service role privileges.
 * WARNING: This client bypasses Row Level Security (RLS).
 * Only use this on the server side (API routes, server components, server actions).
 */
export const supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Helper function to create a fresh server client instance.
 * Use this when you need a new client instance (e.g., in API routes).
 */
export function createServerClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
