import { NextRequest, NextResponse } from 'next/server'
import { syncContactInquiryToGHL } from '@/lib/ghl'
import { evaluateAndQueueEmails } from '@/lib/email-queue'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

interface ContactBody {
  name: string
  email: string
  phone?: string
  message: string
  smsConsent?: boolean
  marketingConsent?: boolean
}

export async function POST(request: NextRequest) {
  if (!checkRateLimit(getClientIp(request), 'contact', 5)) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }
  try {
    const body = (await request.json()) as ContactBody

    if (!body.name || !body.email || !body.message) {
      return NextResponse.json(
        { error: 'name, email, and message are required' },
        { status: 400 },
      )
    }

    // Sync to GHL in the background — does not block the response
    syncContactInquiryToGHL({
      name: body.name,
      email: body.email,
      phone: body.phone,
      message: body.message,
      smsConsent: body.smsConsent ?? false,
      marketingConsent: body.marketingConsent ?? false,
    }).catch((err) => {
      console.error('GHL contact sync error:', err)
    })

    evaluateAndQueueEmails('contact_submitted', {
      type: 'contact',
      name: body.name,
      email: body.email,
      phone: body.phone,
      message: body.message,
    }).catch((err) => { console.error('email queue error on contact_submitted:', err) })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('POST /api/contact error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
