import type { Metadata } from 'next'
import { EnvelopeIcon, PhoneIcon, MapPinIcon, ClockIcon } from '@heroicons/react/24/outline'
import { createServerSupabaseClient } from '@/lib/supabase'
import ContactForm from '@/components/public/ContactForm'
import type { SiteSettings } from '@/types'

export const metadata: Metadata = {
  title: 'Contact Us | Top of the Hill Rooms',
  description:
    'Get in touch with Top of the Hill Rooms — short-term and long-term room rentals in Mesa/Tempe, AZ.',
}

const FALLBACK: Pick<SiteSettings, 'contact_phone' | 'contact_email' | 'contact_address'> = {
  contact_phone: '(480) 555-0000',
  contact_email: 'info@tothrooms.com',
  contact_address: 'Mesa/Tempe, Arizona',
}

export default async function ContactPage() {
  const supabase = await createServerSupabaseClient()
  const { data: settings } = await supabase.from('site_settings').select('*').single()

  const s = settings as SiteSettings | null
  const phone = s?.contact_phone ?? FALLBACK.contact_phone
  const email = s?.contact_email ?? FALLBACK.contact_email
  const address = s?.contact_address ?? FALLBACK.contact_address

  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-12">
          <h1 className="font-display text-4xl font-bold text-primary mb-3">Get in Touch</h1>
          <p className="font-body text-on-surface-variant text-lg max-w-xl">
            Have a question about availability, pricing, or your stay? We&apos;re happy to help.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-8">
            <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-8 shadow-[0_8px_40px_rgba(78,205,196,0.06)]">
              <h2 className="font-display text-xl font-semibold text-primary mb-6">
                Contact Information
              </h2>

              <ul className="space-y-5">
                <ContactInfoRow
                  icon={<PhoneIcon className="w-5 h-5" />}
                  label="Phone"
                  value={
                    <a href={`tel:${phone.replace(/\D/g, '')}`} className="text-secondary hover:underline">
                      {phone}
                    </a>
                  }
                />
                <ContactInfoRow
                  icon={<EnvelopeIcon className="w-5 h-5" />}
                  label="Email"
                  value={
                    <a href={`mailto:${email}`} className="text-secondary hover:underline">
                      {email}
                    </a>
                  }
                />
                <ContactInfoRow
                  icon={<MapPinIcon className="w-5 h-5" />}
                  label="Location"
                  value={<span className="text-on-surface-variant">{address}</span>}
                />
                <ContactInfoRow
                  icon={<ClockIcon className="w-5 h-5" />}
                  label="Business Hours"
                  value={
                    <span className="text-on-surface-variant">
                      Monday – Friday: 9 AM – 6 PM MST
                      <br />
                      Saturday: 10 AM – 4 PM MST
                      <br />
                      Sunday: Closed
                    </span>
                  }
                />
              </ul>
            </div>

            <p className="font-body text-on-surface-variant text-sm leading-relaxed px-1">
              For urgent matters outside business hours, please send us an email and we will
              respond as soon as possible.
            </p>
          </div>

          <div>
            <h2 className="font-display text-xl font-semibold text-primary mb-6">
              Send Us a Message
            </h2>
            <ContactForm />
          </div>
        </div>
      </div>
    </main>
  )
}

function ContactInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-4">
      <span className="text-secondary mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="font-body text-xs text-on-surface-variant uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <div className="font-body text-sm leading-relaxed">{value}</div>
      </div>
    </li>
  )
}
