import { createServiceRoleClient } from '@/lib/supabase'
import type {
  Booking,
  Room,
  Property,
  SiteSettings,
  EmailSettings,
  TriggerEvent,
  ConditionBlock,
  EmailAutomation,
} from '@/types'

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function evaluateConditions(
  conditions: ConditionBlock,
  context: Record<string, unknown>,
): boolean {
  if (!conditions.rules.length) return true

  const results = conditions.rules.map((rule) => {
    const val = context[rule.field]
    const cmp = rule.value
    switch (rule.op) {
      case 'eq':  return val == cmp
      case 'neq': return val != cmp
      case 'gt':  return Number(val) > Number(cmp)
      case 'gte': return Number(val) >= Number(cmp)
      case 'lt':  return Number(val) < Number(cmp)
      case 'lte': return Number(val) <= Number(cmp)
      default:    return true
    }
  })

  return conditions.operator === 'AND' ? results.every(Boolean) : results.some(Boolean)
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function fmtTime(hhmm?: string): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, m)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function buildBookingVariables(
  booking: Booking,
  room: Room & { property?: Property },
  siteSettings: SiteSettings | null,
  emailSettings: EmailSettings | null,
): Record<string, string> {
  return {
    guest_first_name: booking.guest_first_name,
    guest_last_name: booking.guest_last_name,
    guest_email: booking.guest_email,
    guest_phone: booking.guest_phone,
    booking_id: booking.id,
    booking_reference: booking.id.slice(0, 8).toUpperCase(),
    check_in_date: fmtDate(booking.check_in),
    check_out_date: fmtDate(booking.check_out),
    total_nights: String(booking.total_nights),
    total_amount: `$${booking.total_amount.toFixed(2)}`,
    room_name: room.name,
    property_name: room.property?.name ?? '',
    booking_type: booking.booking_type === 'short_term' ? 'Short-Term' : 'Long-Term',
    property_address: room.property?.address ?? '',
    checkin_time: fmtTime(siteSettings?.checkin_time),
    checkout_time: fmtTime(siteSettings?.checkout_time),
    house_rules: siteSettings?.global_house_rules ?? room.property?.house_rules ?? room.house_rules ?? '',
    business_name: siteSettings?.business_name ?? emailSettings?.from_name ?? '',
    contact_phone: siteSettings?.contact_phone ?? '',
    contact_email: siteSettings?.contact_email ?? emailSettings?.from_email ?? '',
    review_url: emailSettings?.review_url ?? '',
  }
}

export function buildContactVariables(
  contact: { name: string; email: string; phone?: string; message: string },
  siteSettings: SiteSettings | null,
  emailSettings: EmailSettings | null,
): Record<string, string> {
  return {
    contact_name: contact.name,
    contact_email: contact.email,
    contact_phone: contact.phone ?? '',
    contact_message: contact.message,
    business_name: siteSettings?.business_name ?? emailSettings?.from_name ?? '',
    business_phone: siteSettings?.contact_phone ?? '',
    business_email: siteSettings?.contact_email ?? emailSettings?.from_email ?? '',
    review_url: emailSettings?.review_url ?? '',
  }
}

const REMINDER_EVENTS: TriggerEvent[] = [
  'checkin_reminder',
  'checkout_reminder',
  'post_checkout',
  'review_request',
]

function buildEvalContext(booking: Booking): Record<string, unknown> {
  return {
    booking_type: booking.booking_type,
    total_nights: booking.total_nights,
    total_amount: booking.total_amount,
    room_id: booking.room_id,
    marketing_consent: booking.marketing_consent,
    sms_consent: booking.sms_consent,
  }
}

type ContactContext = { name: string; email: string; phone?: string; message: string }

export type EmailContext =
  | { type: 'booking'; bookingId: string }
  | { type: 'booking_payment_request'; bookingId: string; paymentAmount: string; paymentLink: string }
  | ({ type: 'contact' } & ContactContext)

export async function evaluateAndQueueEmails(
  event: TriggerEvent,
  context: EmailContext,
): Promise<void> {
  const supabase = createServiceRoleClient()

  try {
    const isBookingContext =
      context.type === 'booking' || context.type === 'booking_payment_request'

    const [
      { data: automations },
      { data: bookingData, error: bookingError },
      { data: emailSettings },
      { data: siteSettings },
    ] = await Promise.all([
      supabase
        .from('email_automations')
        .select('*')
        .eq('trigger_event', event)
        .eq('is_active', true),
      isBookingContext
        ? supabase
            .from('bookings')
            .select('*, room:rooms(*, property:properties(*))')
            .eq('id', (context as { bookingId: string }).bookingId)
            .single()
        : Promise.resolve({ data: null, error: null }),
      supabase.from('email_settings').select('*').maybeSingle(),
      supabase.from('site_settings').select('*').maybeSingle(),
    ])

    if (!automations?.length) return

    let booking: Booking | null = null
    if (isBookingContext) {
      if (!bookingData) {
        console.error(
          `evaluateAndQueueEmails: booking ${(context as { bookingId: string }).bookingId} not found`,
          bookingError,
        )
        return
      }
      booking = bookingData as Booking
    }

    const now = new Date()
    const queueRows: Array<Record<string, unknown>> = []

    for (const automation of automations as EmailAutomation[]) {
      if (!automation.template_id) continue

      const evalCtx = booking ? buildEvalContext(booking) : {}
      if (!evaluateConditions(automation.conditions, evalCtx)) continue

      let variables =
        booking?.room
          ? buildBookingVariables(
              booking,
              booking.room as Room & { property?: Property },
              siteSettings as SiteSettings | null,
              emailSettings as EmailSettings | null,
            )
          : context.type === 'contact'
          ? buildContactVariables(
              context as ContactContext,
              siteSettings as SiteSettings | null,
              emailSettings as EmailSettings | null,
            )
          : {}

      if (context.type === 'booking_payment_request') {
        variables = {
          ...variables,
          payment_amount: context.paymentAmount,
          payment_link: context.paymentLink,
        }
      }

      const adminEmails = (emailSettings as EmailSettings | null)?.admin_recipients ?? []
      const guestEmail =
        booking?.guest_email ??
        (context.type === 'contact' ? (context as ContactContext).email : null)

      const recipients: string[] = []
      if (
        (automation.recipient_type === 'guest' || automation.recipient_type === 'both') &&
        guestEmail
      ) {
        recipients.push(guestEmail)
      }
      if (automation.recipient_type === 'admin' || automation.recipient_type === 'both') {
        recipients.push(...adminEmails)
      }

      if (!recipients.length) continue

      const sendAt = new Date(now.getTime() + automation.delay_minutes * 60 * 1000)

      for (const recipientEmail of recipients) {
        queueRows.push({
          automation_id: automation.id,
          template_id: automation.template_id,
          booking_id: booking?.id ?? null,
          recipient_email: recipientEmail,
          recipient_type: automation.recipient_type === 'admin' ? 'admin' : 'guest',
          send_at: sendAt.toISOString(),
          resolved_variables: variables,
        })
      }
    }

    if (queueRows.length) {
      const { error } = await supabase.from('email_queue').insert(queueRows)
      if (error) console.error('email_queue insert error:', error)
    }
  } catch (err) {
    console.error('evaluateAndQueueEmails error:', err)
  }
}

export async function cancelBookingEmails(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  try {
    const { data: cancelAutomations } = await supabase
      .from('email_automations')
      .select('id')
      .in('trigger_event', ['booking_cancelled', 'admin_cancelled'])

    const excludeIds = (cancelAutomations ?? []).map((a: { id: string }) => a.id)

    let query = supabase
      .from('email_queue')
      .update({ status: 'cancelled' })
      .eq('booking_id', bookingId)
      .eq('status', 'pending')

    if (excludeIds.length) {
      query = query.not('automation_id', 'in', `(${excludeIds.join(',')})`)
    }

    const { error } = await query
    if (error) console.error('cancelBookingEmails error:', error)
  } catch (err) {
    console.error('cancelBookingEmails error:', err)
  }
}

export async function seedReminderEmails(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient()
  try {
    const { data: bookingData } = await supabase
      .from('bookings')
      .select('*, room:rooms(*, property:properties(*))')
      .eq('id', bookingId)
      .single()

    if (!bookingData) return

    const { data: automations } = await supabase
      .from('email_automations')
      .select('*')
      .in('trigger_event', REMINDER_EVENTS)
      .eq('is_active', true)

    if (!automations?.length) return

    const [{ data: emailSettings }, { data: siteSettings }] = await Promise.all([
      supabase.from('email_settings').select('*').maybeSingle(),
      supabase.from('site_settings').select('*').maybeSingle(),
    ])

    const booking = bookingData as Booking & { room?: Room & { property?: Property } }
    const variables = booking.room
      ? buildBookingVariables(
          booking,
          booking.room as Room & { property?: Property },
          siteSettings as SiteSettings | null,
          emailSettings as EmailSettings | null,
        )
      : {}

    const adminEmails = (emailSettings as EmailSettings | null)?.admin_recipients ?? []
    const checkInBase = new Date(booking.check_in + 'T12:00:00Z')
    const checkOutBase = new Date(booking.check_out + 'T12:00:00Z')
    const now = new Date()
    const queueRows: Array<Record<string, unknown>> = []

    for (const automation of automations as EmailAutomation[]) {
      if (!automation.template_id) continue

      if (!evaluateConditions(automation.conditions, buildEvalContext(booking))) continue

      const baseDate =
        automation.trigger_event === 'checkin_reminder' ? checkInBase : checkOutBase
      const sendAt = new Date(baseDate.getTime() + automation.delay_minutes * 60 * 1000)

      if (sendAt <= now) continue

      const recipients: string[] = []
      if (automation.recipient_type === 'guest' || automation.recipient_type === 'both') {
        recipients.push(booking.guest_email)
      }
      if (automation.recipient_type === 'admin' || automation.recipient_type === 'both') {
        recipients.push(...adminEmails)
      }

      for (const recipientEmail of recipients) {
        queueRows.push({
          automation_id: automation.id,
          template_id: automation.template_id,
          booking_id: booking.id,
          recipient_email: recipientEmail,
          recipient_type: automation.recipient_type === 'admin' ? 'admin' : 'guest',
          send_at: sendAt.toISOString(),
          resolved_variables: variables,
        })
      }
    }

    if (queueRows.length) {
      const { error } = await supabase.from('email_queue').insert(queueRows)
      if (error) console.error('seedReminderEmails insert error:', error)
    }
  } catch (err) {
    console.error('seedReminderEmails error:', err)
  }
}
