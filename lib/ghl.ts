import { createServiceRoleClient } from '@/lib/supabase'
import type { Booking, Room } from '@/types'

const GHL_BASE_URL = 'https://services.leadconnectorhq.com'
const GHL_VERSION = '2021-07-28'

/**
 * Creates or updates a contact in GoHighLevel (API v2 / Private Integration).
 * Returns the GHL contact ID on success, or null on failure.
 */
export async function createOrUpdateGHLContact(data: {
  firstName: string
  lastName: string
  email: string
  phone: string
  tags: string[]
  customFields: { id: string; field_value: string }[]
}): Promise<string | null> {
  const apiKey = process.env.GHL_API_KEY ?? ''
  const locationId = process.env.GHL_LOCATION_ID ?? ''

  if (!apiKey) {
    console.warn('GHL_API_KEY not set — skipping CRM sync')
    return null
  }
  if (!locationId) {
    console.warn('GHL_LOCATION_ID not set — skipping CRM sync')
    return null
  }

  try {
    const response = await fetch(`${GHL_BASE_URL}/contacts/upsert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: GHL_VERSION,
      },
      body: JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        locationId,
        tags: data.tags,
        customFields: data.customFields,
      }),
    })

    if (!response.ok) {
      console.error('GHL contact upsert failed:', response.status, await response.text())
      return null
    }

    const json = (await response.json()) as { contact?: { id?: string } }
    return json.contact?.id ?? null
  } catch (error) {
    console.error('GHL API error:', error)
    return null
  }
}

/**
 * Triggers a GoHighLevel automation workflow via webhook.
 */
export async function triggerGHLWorkflow(
  webhookUrl: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!webhookUrl) {
    console.warn('GHL webhook URL not provided — skipping workflow trigger')
    return
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error('GHL workflow trigger failed:', response.status, await response.text())
    }
  } catch (error) {
    console.error('GHL workflow error:', error)
  }
}

/**
 * Syncs a booking to GoHighLevel — creates/updates the contact and triggers
 * the booking workflow. Called on booking creation to capture the lead.
 */
export async function syncToGHL(booking: Booking): Promise<void> {
  const supabase = createServiceRoleClient()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*, property:properties(*)')
    .eq('id', booking.room_id)
    .single()

  if (roomError || !room) {
    console.error('GHL sync: failed to fetch room', roomError)
    return
  }

  const typedRoom = room as Room

  const ghlContactId = await createOrUpdateGHLContact({
    firstName: booking.guest_first_name,
    lastName: booking.guest_last_name,
    email: booking.guest_email,
    phone: booking.guest_phone,
    tags: [booking.booking_type, typedRoom.property?.name ?? '', typedRoom.name],
    customFields: [
      { id: process.env.GHL_FIELD_CHECK_IN_ID ?? 'VLXN19uIDL0f84gREYyy', field_value: booking.check_in },
      { id: process.env.GHL_FIELD_CHECK_OUT_ID ?? '20RfeImKFzB2wsX3rSH5', field_value: booking.check_out },
      { id: process.env.GHL_FIELD_ROOM_NAME_ID ?? 'f2m4XC2ByCQWKfZJHntE', field_value: typedRoom.name },
      { id: process.env.GHL_FIELD_BOOKING_ID ?? 'UongSn70hGlckbsmyMkD', field_value: booking.id },
    ],
  })

  if (ghlContactId) {
    await Promise.all([
      supabase.from('bookings').update({ ghl_contact_id: ghlContactId }).eq('id', booking.id),
      triggerGHLWorkflow(process.env.GHL_BOOKING_WEBHOOK_URL ?? '', {
        bookingId: booking.id,
        contactId: ghlContactId,
        ...booking,
      }),
    ])
  }
}

/**
 * Syncs a contact-form inquiry to GoHighLevel — creates/updates the contact
 * and optionally triggers GHL_CONTACT_WEBHOOK_URL with the full submission.
 */
export async function syncContactInquiryToGHL(data: {
  name: string
  email: string
  phone?: string
  message: string
  smsConsent: boolean
  marketingConsent: boolean
}): Promise<void> {
  const nameParts = data.name.trim().split(/\s+/)
  const firstName = nameParts[0] ?? data.name
  const lastName = nameParts.slice(1).join(' ')

  const tags = ['contact-inquiry']
  if (data.marketingConsent) tags.push('marketing-opted-in')
  if (data.smsConsent) tags.push('sms-opted-in')

  const ghlContactId = await createOrUpdateGHLContact({
    firstName,
    lastName,
    email: data.email,
    phone: data.phone ?? '',
    tags,
    customFields: [],
  })

  const webhookUrl = process.env.GHL_CONTACT_WEBHOOK_URL ?? ''
  if (webhookUrl) {
    await triggerGHLWorkflow(webhookUrl, {
      contactId: ghlContactId,
      name: data.name,
      email: data.email,
      phone: data.phone ?? '',
      message: data.message,
      smsConsent: data.smsConsent,
      marketingConsent: data.marketingConsent,
    })
  }
}

/**
 * Notifies GoHighLevel that a booking has been confirmed (payment succeeded).
 * Uses GHL_BOOKING_CONFIRMED_WEBHOOK_URL so you can route it to a separate
 * automation from the initial lead capture.
 */
export async function notifyGHLBookingConfirmed(booking: Booking): Promise<void> {
  const webhookUrl = process.env.GHL_BOOKING_CONFIRMED_WEBHOOK_URL ?? ''
  if (!webhookUrl) {
    console.warn('GHL_BOOKING_CONFIRMED_WEBHOOK_URL not set — skipping confirmation trigger')
    return
  }

  const supabase = createServiceRoleClient()

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*, property:properties(*)')
    .eq('id', booking.room_id)
    .single()

  if (roomError || !room) {
    console.error('GHL confirmation: failed to fetch room', roomError)
    return
  }

  const typedRoom = room as Room

  await triggerGHLWorkflow(webhookUrl, {
    bookingId: booking.id,
    contactId: booking.ghl_contact_id,
    status: 'confirmed',
    guestFirstName: booking.guest_first_name,
    guestLastName: booking.guest_last_name,
    guestEmail: booking.guest_email,
    guestPhone: booking.guest_phone,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    totalNights: booking.total_nights,
    totalAmount: booking.total_amount,
    amountPaid: booking.amount_paid,
    amountDueAtCheckin: booking.amount_due_at_checkin,
    bookingType: booking.booking_type,
    roomName: typedRoom.name,
    roomSlug: typedRoom.slug,
    propertyName: typedRoom.property?.name ?? '',
    propertyAddress: typedRoom.property?.address ?? '',
    propertyCity: typedRoom.property?.city ?? '',
    propertyState: typedRoom.property?.state ?? '',
  })
}

/**
 * Syncs a long-term rental inquiry to GoHighLevel — creates/updates the contact
 * and triggers GHL_CONTACT_WEBHOOK_URL with a 'long-term-inquiry' tag.
 */
export async function syncLongTermInquiryToGHL(data: {
  firstName: string
  lastName: string
  email: string
  phone: string
  moveIn: string
  occupants: number
  roomSlug: string
  roomName: string
  propertyName: string
  smsConsent: boolean
  marketingConsent: boolean
}): Promise<void> {
  const tags = ['long-term-inquiry']
  if (data.smsConsent) tags.push('sms-opted-in')
  if (data.marketingConsent) tags.push('marketing-opted-in')

  const ghlContactId = await createOrUpdateGHLContact({
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    tags,
    customFields: [
      { id: process.env.GHL_FIELD_MOVE_IN_DATE_ID ?? 'iPzaNsmpAS1JaCeE4Zz7', field_value: data.moveIn },
      { id: process.env.GHL_FIELD_LT_ROOM_NAME_ID ?? 'jFhvUuOUarVOEjN1tZJO', field_value: data.roomName },
    ],
  })

  const webhookUrl = process.env.GHL_CONTACT_WEBHOOK_URL ?? ''
  if (webhookUrl) {
    await triggerGHLWorkflow(webhookUrl, {
      contactId: ghlContactId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      moveIn: data.moveIn,
      occupants: data.occupants,
      roomSlug: data.roomSlug,
      roomName: data.roomName,
      propertyName: data.propertyName,
      smsConsent: data.smsConsent,
      marketingConsent: data.marketingConsent,
    })
  }
}
