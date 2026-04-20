import { NextRequest, NextResponse } from 'next/server'
import { evaluateAndQueueEmails } from '@/lib/email-queue'

interface ContactBody {
  name: string
  email: string
  phone?: string
  message: string
  smsConsent?: boolean
  marketingConsent?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ContactBody

    if (!body.name || !body.email || !body.message) {
      return NextResponse.json(
        { error: 'name, email, and message are required' },
        { status: 400 },
      )
    }

    // Log submission for now; GHL webhook integration can be added when credentials are available
    console.log('Contact form submission:', {
      name: body.name,
      email: body.email,
      phone: body.phone,
      smsConsent: body.smsConsent ?? false,
      marketingConsent: body.marketingConsent ?? false,
      messageLength: body.message.length,
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
