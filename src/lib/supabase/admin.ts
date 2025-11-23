import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client that uses the service role key.
 * Only call this helper from secure server environments (API routes, jobs).
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase admin client missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        "X-Admin-Client": "chimera-admin",
      },
    },
  });
}
