// Supabase client — credentials are loaded from environment variables
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || supabaseUrl === 'https://your-project-id.supabase.co') {
  console.warn(
    '[Drinks Stash] Supabase URL not configured. ' +
    'Copy .env.example to .env and add your credentials. ' +
    'See README.md for instructions.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)
