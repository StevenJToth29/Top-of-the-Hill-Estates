import { createBrowserClient, createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { log } from '@/lib/logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

// Wraps fetch to log every PostgREST database call with table, operation, and duration.
// Auth and storage calls are passed through without logging.
function buildLoggedFetch(client: string): typeof fetch {
  return async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : (url as Request).url

    const rpcMatch = urlStr.match(/\/rest\/v1\/rpc\/([^?]+)/)
    const restMatch = urlStr.match(/\/rest\/v1\/([^?]+)/)
    if (!restMatch) return fetch(url, init)

    let table: string
    let operation: string
    if (rpcMatch) {
      table = 'rpc'
      operation = rpcMatch[1]
    } else {
      table = restMatch[1]
      const method = (init?.method ?? 'GET').toUpperCase()
      const opMap: Record<string, string> = { GET: 'select', POST: 'insert', PATCH: 'update', DELETE: 'delete' }
      operation = opMap[method] ?? method.toLowerCase()
    }

    const start = Date.now()
    try {
      const response = await fetch(url, init)
      const duration_ms = Date.now() - start
      if (!response.ok) {
        log.warn('db_error', { client, table, operation, duration_ms, http_status: response.status })
      } else {
        log.info('db_query', { client, table, operation, duration_ms })
      }
      return response
    } catch (err) {
      const duration_ms = Date.now() - start
      log.error('db_failed', { client, table, operation, duration_ms, error: err instanceof Error ? err.message : String(err) })
      throw err
    }
  }
}

/**
 * Browser client — use in Client Components.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: buildLoggedFetch('browser') },
  })
}

/**
 * Server client — use in Server Components and Route Handlers.
 * Reads cookies from the incoming request.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // setAll called from a Server Component — safe to ignore
        }
      },
    },
    global: { fetch: buildLoggedFetch('server') },
  })
}

/**
 * Service-role client — use only in trusted server-side code (API routes, cron jobs).
 * Bypasses Row Level Security.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: { fetch: buildLoggedFetch('service_role') },
  })
}
