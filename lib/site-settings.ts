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

// Cached legal content — invalidated by revalidateTag('site_settings') on settings save.
export const getLegalContent = unstable_cache(
  async () => {
    const supabase = createServiceRoleClient()
    const { data } = await supabase
      .from('site_settings')
      .select('privacy_policy_html, terms_of_service_html, legal_last_updated')
      .limit(1)
      .maybeSingle()
    return data ?? null
  },
  ['site_settings_legal'],
  { tags: ['site_settings'] },
)
