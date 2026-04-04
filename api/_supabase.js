import { createClient } from '@supabase/supabase-js'

// Shared Supabase client for use inside serverless API functions.
// The VITE_ prefixed env vars are available to Vercel serverless functions
// via process.env (the prefix is only meaningful to the Vite build tool).
export function getSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Supabase credentials (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) are not configured on the server.')
  }
  return createClient(url, key)
}
