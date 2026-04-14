import type { Metadata } from 'next'
import LegalSection from '@/components/public/LegalSection'

export const metadata: Metadata = {
  title: 'Terms and Conditions | Top of the Hill Rooms',
  description: 'Terms and Conditions for booking with Top of the Hill Rooms — Top of the Hill Estates, LLC',
}

const LAST_UPDATED = 'April 14, 2026'

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen bg-surface-low py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-4xl font-bold text-primary mb-2">
          Terms and Conditions
        </h1>
        <p className="font-body text-on-surface-variant mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-10 font-body text-on-surface-variant leading-relaxed">
          <p>
            Please read these Terms and Conditions (&ldquo;Terms&rdquo;) carefully before booking a
            room with Top of the Hill Estates, LLC (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or
            &ldquo;us&rdquo;). By completing a booking, you agree to be bound by these Terms.
          </p>

          <LegalSection title="1. Acceptance of Terms">
            <p>
              By accessing our website and making a reservation, you confirm that you are at least
              18 years of age, have the legal capacity to enter into a binding agreement, and agree
              to these Terms in full. If you do not agree, please do not proceed with a booking.
            </p>
          </LegalSection>

          <LegalSection title="2. Booking and Reservation Policy">
            <p>
              All reservations are subject to availability. A booking is confirmed only after we
              receive full payment (or an approved deposit, for eligible long-term stays) and you
              receive a written confirmation with a booking reference number.
            </p>
            <p className="mt-3">
              You are responsible for ensuring that all guest information provided at booking is
              accurate. Discrepancies may result in denied check-in. Reservations are
              non-transferable.
            </p>
          </LegalSection>

          <LegalSection title="3. Payment Terms">
            <p>
              All payments are processed securely through Stripe. By providing payment information,
              you authorize us to charge the applicable amount.
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>
                <strong className="text-on-surface">Short-term bookings:</strong> Full payment is
                due at the time of booking, unless otherwise stated.
              </li>
              <li>
                <strong className="text-on-surface">Long-term bookings:</strong> A deposit is
                required to confirm the reservation. The remaining balance is due at check-in per
                the terms disclosed at the time of booking.
              </li>
              <li>
                All rates are quoted in U.S. dollars and are subject to applicable taxes and fees
                as disclosed during checkout.
              </li>
              <li>
                We reserve the right to correct pricing errors. If an error is discovered after
                booking, we will notify you and offer a full refund or the corrected rate.
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="4. Cancellation Policy">
            <p className="font-semibold text-on-surface">Short-term Stays</p>
            <ul className="list-disc list-inside mt-2 space-y-2">
              <li>
                Cancellation more than <strong className="text-on-surface">7 days</strong> before
                check-in: Full refund.
              </li>
              <li>
                Cancellation more than <strong className="text-on-surface">72 hours</strong> but
                7 days or less before check-in: 50% refund of the total booking amount.
              </li>
              <li>
                Cancellation <strong className="text-on-surface">72 hours or less</strong> before
                check-in: No refund.
              </li>
            </ul>
            <p className="font-semibold text-on-surface mt-5">Long-term Stays</p>
            <ul className="list-disc list-inside mt-2 space-y-2">
              <li>
                All deposits for long-term reservations are{' '}
                <strong className="text-on-surface">non-refundable</strong>.
              </li>
              <li>
                Early termination of a long-term stay may result in forfeiture of remaining rent
                owed, as outlined in your rental agreement.
              </li>
            </ul>
            <p className="mt-4">
              Refunds, where applicable, are processed to the original payment method within 5–10
              business days. We are not responsible for delays caused by your financial institution.
            </p>
          </LegalSection>

          <LegalSection title="5. Guest Responsibilities">
            <p>As a guest, you agree to:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>
                Comply with all posted house rules and community guidelines for your property.
              </li>
              <li>
                Treat the room and common areas with reasonable care. You are financially
                responsible for any damages beyond normal wear and tear caused by you or your guests.
              </li>
              <li>
                Not exceed the stated maximum occupancy for your room.
              </li>
              <li>
                Maintain reasonable noise levels and respect other residents and neighbors.
              </li>
              <li>
                Immediately report any maintenance issues, safety concerns, or property damage to
                management.
              </li>
            </ul>
          </LegalSection>

          <LegalSection title="6. Check-in / Check-out Procedures">
            <p>
              Check-in time and check-out time will be communicated in your booking confirmation.
              Early check-in and late check-out are subject to availability and may incur additional
              charges. Failure to vacate by the stated check-out time may result in additional fees.
            </p>
            <p className="mt-3">
              You must present a valid government-issued photo ID at check-in. We reserve the right
              to deny entry if identity cannot be verified.
            </p>
          </LegalSection>

          <LegalSection title="7. Prohibited Uses">
            <p>The following are strictly prohibited and may result in immediate removal without refund:</p>
            <ul className="list-disc list-inside mt-3 space-y-2">
              <li>Subletting or re-renting the room to another party.</li>
              <li>Use of the premises for any illegal activities.</li>
              <li>Unauthorized parties or gatherings exceeding the maximum occupancy.</li>
              <li>
                Smoking inside any building. Designated smoking areas, if available, will be
                communicated at check-in.
              </li>
              <li>Pets, unless explicitly authorized in writing by management.</li>
              <li>Any behavior that endangers the safety of other residents or staff.</li>
            </ul>
          </LegalSection>

          <LegalSection title="8. Liability Limitations">
            <p>
              To the maximum extent permitted by applicable law, Top of the Hill Estates, LLC is
              not liable for any indirect, incidental, special, or consequential damages arising
              from your stay or use of our services, including but not limited to loss of personal
              property, injury, or disruption of your stay due to circumstances beyond our
              reasonable control (including but not limited to natural disasters, utility outages,
              or force majeure events).
            </p>
            <p className="mt-3">
              We are not responsible for the loss or theft of personal belongings. We recommend
              securing valuables and obtaining appropriate travel or renters&apos; insurance.
            </p>
            <p className="mt-3">
              Our total liability to you for any claim shall not exceed the amount you paid for the
              specific booking giving rise to the claim.
            </p>
          </LegalSection>

          <LegalSection title="9. Governing Law">
            <p>
              These Terms are governed by and construed in accordance with the laws of the State of
              Arizona, without regard to its conflict of law principles. Any disputes arising from
              these Terms or your use of our services shall be subject to the exclusive jurisdiction
              of the courts located in Maricopa County, Arizona.
            </p>
          </LegalSection>

          <LegalSection title="10. Contact Information">
            <p>
              If you have questions about these Terms, please contact us:
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
        </div>
      </div>
    </main>
  )
}
