// Safe to import in Client Components — does not pull in next/headers.
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
