import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase'

export const getSiteSettings = unstable_cache(
  async () => {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from('site_settings')
      .select(
        'logo_url, logo_size, contact_phone, contact_email, contact_address, about_text, global_house_rules, stripe_fee_percent, stripe_fee_flat, cancellation_policy',
      )
      .limit(1)
      .maybeSingle()
    return data ?? null
  },
  ['site_settings'],
  { revalidate: 3600, tags: ['site_settings'] },
)
