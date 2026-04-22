import { NextResponse } from 'next/server'
import { syncLongTermInquiryToGHL } from '@/lib/ghl'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: Request) {
  if (!checkRateLimit(getClientIp(req), 'inquiry', 5)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }
  const body = await req.json()
  const {
    first_name,
    last_name,
    email,
    phone,
    move_in,
    occupants,
    room_slug,
    room_name,
    property_name,
    sms_consent,
    marketing_consent,
  } = body as Record<string, unknown>

  if (!String(first_name ?? '').trim())
    return NextResponse.json({ error: 'First name is required.' }, { status: 400 })
  if (!String(last_name ?? '').trim())
    return NextResponse.json({ error: 'Last name is required.' }, { status: 400 })
  if (!String(email ?? '').trim() || !EMAIL_RE.test(String(email).trim()))
    return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 })
  if (String(phone ?? '').replace(/\D/g, '').length < 10)
    return NextResponse.json({ error: 'Valid phone number is required.' }, { status: 400 })
  if (!String(move_in ?? '').trim())
    return NextResponse.json({ error: 'Move-in date is required.' }, { status: 400 })
  const parsedOccupants = Number(occupants)
  if (!occupants || !Number.isFinite(parsedOccupants) || parsedOccupants < 1)
    return NextResponse.json({ error: 'Number of occupants is required.' }, { status: 400 })

  if (!sms_consent) {
    return NextResponse.json({ error: 'SMS consent is required.' }, { status: 400 })
  }

  try {
    await syncLongTermInquiryToGHL({
      firstName: String(first_name).trim(),
      lastName: String(last_name).trim(),
      email: String(email).trim(),
      phone: String(phone ?? '').trim(),
      moveIn: String(move_in).trim(),
      occupants: parsedOccupants,
      roomSlug: String(room_slug ?? ''),
      roomName: String(room_name ?? ''),
      propertyName: String(property_name ?? ''),
      smsConsent: Boolean(sms_consent),
      marketingConsent: Boolean(marketing_consent),
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[inquiries] GHL sync failed:', err)
    return NextResponse.json(
      { error: 'Failed to submit inquiry. Please try again.' },
      { status: 500 },
    )
  }
}
