import type { Metadata } from 'next'
import LegalSection from '@/components/public/LegalSection'

export const metadata: Metadata = {
  title: 'Privacy Policy | Top of the Hill Rooms',
  description: 'Privacy Policy for Top of the Hill Rooms — Top of the Hill Estates, LLC',
}

const LAST_UPDATED = 'April 14, 2026'

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-surface-low py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-4xl font-bold text-primary mb-2">Privacy Policy</h1>
        <p className="font-body text-on-surface-variant mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-10 font-body text-on-surface-variant leading-relaxed">
          <p>
            Top of the Hill Estates, LLC (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;)
            operates the Top of the Hill Rooms booking platform. This Privacy Policy explains how we
            collect, use, and protect your personal information when you use our services.
          </p>

          <LegalSection title="1. Information We Collect">
            <p>We collect the following categories of information:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>
                <strong className="text-on-surface">Personal identifiers:</strong> Full name, email
                address, and phone number provided at booking.
              </li>
              <li>
                <strong className="text-on-surface">Payment information:</strong> Credit and debit
                card details processed securely by Stripe. We do not store full card numbers.
              </li>
              <li>
                <strong className="text-on-surface">Booking data:</strong> Check-in and check-out
                dates, room selections, stay duration, booking type, and transaction history.
              </li>
              <li>
                <strong className="text-on-surface">Communication preferences:</strong> SMS and
                marketing consent choices you make during the booking process.
              </li>
              <li>
                <strong className="text-on-surface">Usage data:</strong> Browser type, IP address,
                and pages visited, collected automatically when you use our website.
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="2. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>Process and confirm your booking reservations.</li>
              <li>
                Send transactional communications including booking confirmations, check-in
                instructions, and important updates via email and SMS.
              </li>
              <li>Process payments and issue refunds through Stripe.</li>
              <li>Maintain our customer relationship management (CRM) system via GoHighLevel.</li>
              <li>
                Respond to your inquiries and provide customer support.
              </li>
              <li>
                Send marketing communications about promotions and availability, only if you have
                provided explicit consent.
              </li>
              <li>Comply with legal obligations.</li>
            </ul>
          </LegalSection>

          <LegalSection title="3. Text Message Communications">
            <p>
              By providing your mobile phone number, you may receive text messages from Top of the
              Hill Estates, LLC. We operate under the A2P 10DLC (Application-to-Person) messaging
              framework.
            </p>
            <p className="mt-3">
              <strong className="text-on-surface">Non-marketing messages:</strong> If you provide a
              phone number during booking, you consent to receive transactional SMS messages related
              to your reservation (booking confirmation, check-in details, updates). These messages
              are necessary for your booking and are sent even without additional marketing consent.
            </p>
            <p className="mt-3">
              <strong className="text-on-surface">Marketing messages:</strong> Promotional messages
              — including special offers and availability updates — are sent only if you
              specifically opt in during the booking process.
            </p>
            <p className="mt-3">
              <strong className="text-on-surface">Opting out:</strong> You may opt out of text
              messages at any time by replying <strong className="text-on-surface">STOP</strong> to
              any message. After opting out, you will receive a single confirmation message and no
              further texts (except as required by law). To re-subscribe, reply{' '}
              <strong className="text-on-surface">START</strong>.
            </p>
            <p className="mt-3">
              Message and data rates may apply. Message frequency varies.
            </p>
          </LegalSection>

          <LegalSection title="4. Information Sharing">
            <p>
              We do not sell your personal information. We share information only with trusted
              service providers necessary to operate our business:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>
                <strong className="text-on-surface">Stripe:</strong> For secure payment processing.
                Stripe&apos;s privacy policy is available at{' '}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-secondary hover:underline"
                >
                  stripe.com/privacy
                </a>
                .
              </li>
              <li>
                <strong className="text-on-surface">GoHighLevel:</strong> For CRM and communication
                management. Data is used solely to manage your relationship with us.
              </li>
              <li>
                <strong className="text-on-surface">Hosting and infrastructure providers</strong>{' '}
                who process data on our behalf under confidentiality agreements.
              </li>
            </ul>
            <p className="mt-3">
              We will not share your data with third-party marketing organizations without your
              explicit consent. We may disclose information if required by law or to protect the
              rights and safety of our guests and property.
            </p>
          </LegalSection>

          <LegalSection title="5. Data Security">
            <p>
              We take reasonable technical and organizational measures to protect your personal
              information from unauthorized access, disclosure, alteration, or destruction. Payment
              data is handled exclusively by Stripe, which maintains PCI DSS compliance. Our
              database is hosted on Supabase with encrypted connections and access controls.
            </p>
            <p className="mt-3">
              Despite our efforts, no method of transmission over the internet or electronic storage
              is 100% secure. Please contact us immediately at{' '}
              <a href="mailto:info@tothrooms.com" className="text-secondary hover:underline">
                info@tothrooms.com
              </a>{' '}
              if you suspect any unauthorized use of your account.
            </p>
          </LegalSection>

          <LegalSection title="6. Your Rights">
            <p>You have the following rights regarding your personal information:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>
                <strong className="text-on-surface">Access:</strong> Request a copy of the personal
                data we hold about you.
              </li>
              <li>
                <strong className="text-on-surface">Correction:</strong> Request correction of
                inaccurate or incomplete data.
              </li>
              <li>
                <strong className="text-on-surface">Deletion:</strong> Request deletion of your
                personal data, subject to legal retention requirements.
              </li>
              <li>
                <strong className="text-on-surface">Opt-out of SMS:</strong> Reply STOP to any text
                message at any time.
              </li>
              <li>
                <strong className="text-on-surface">Opt-out of email marketing:</strong> Use the
                unsubscribe link in any marketing email.
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:info@tothrooms.com" className="text-secondary hover:underline">
                info@tothrooms.com
              </a>
              .
            </p>
          </LegalSection>

          <LegalSection title="7. Contact Information">
            <p>
              For privacy-related questions or to exercise your rights, contact Top of the Hill
              Estates, LLC:
            </p>
            <address className="not-italic mt-3 space-y-1">
              <p>Top of the Hill Estates, LLC</p>
              <p>Mesa/Tempe, Arizona</p>
              <p>
                Email:{' '}
                <a href="mailto:info@tothrooms.com" className="text-secondary hover:underline">
                  info@tothrooms.com
                </a>
              </p>
            </address>
          </LegalSection>

          <LegalSection title="8. Updates to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will revise the
              &ldquo;Last updated&rdquo; date at the top of this page. We encourage you to review
              this policy periodically. Continued use of our services after changes are posted
              constitutes your acceptance of the revised policy.
            </p>
          </LegalSection>
        </div>
      </div>
    </main>
  )
}
