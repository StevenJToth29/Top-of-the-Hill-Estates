import Stripe from 'stripe'

let _client: Stripe | null = null

function getClient(): Stripe {
  if (!_client) {
    _client = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
      apiVersion: '2026-03-25.dahlia',
    })
  }
  return _client
}

// Lazy proxy — the Stripe constructor only runs on first access at runtime,
// not at module load time during Next.js static analysis.
export const stripe = new Proxy({} as Stripe, {
  get(_, prop: string | symbol) {
    const client = getClient()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? (value as Function).bind(client) : value
  },
})
