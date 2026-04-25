import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceRoleClient } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface RequestBody {
  guest_index: number
  guest_name: string
  current_address: string
  id_photo_url: string
  image_base64: string
  image_mime_type: string
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params
  const supabase = createServiceRoleClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, guest_count')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status !== 'pending_docs') {
    return NextResponse.json({ error: 'Validation not available' }, { status: 400 })
  }

  const body = (await req.json()) as RequestBody
  const { guest_index, guest_name, current_address, id_photo_url, image_base64, image_mime_type } = body

  if (guest_index < 1 || guest_index > (booking.guest_count ?? 1)) {
    return NextResponse.json({ error: 'Invalid guest_index' }, { status: 400 })
  }

  let ai_quality_result: 'pass' | 'fail_blurry' | 'fail_partial' = 'pass'
  let ai_authenticity_flag: 'clear' | 'flagged' | 'uncertain' = 'clear'
  let ai_validation_notes = ''

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image_mime_type as 'image/jpeg' | 'image/png' | 'image/webp',
                data: image_base64,
              },
            },
            {
              type: 'text',
              text: `You are evaluating a government-issued photo ID for a rental property booking.
Assess this image on two dimensions:

1. IMAGE QUALITY (hard gate):
   - Is the text readable and not blurry?
   - Is the full ID visible without cropping?
   Answer: PASS or FAIL_BLURRY or FAIL_PARTIAL

2. AUTHENTICITY (soft flag for admin):
   - Does this appear to be a genuine government-issued ID document?
   - Are security features, layout, and formatting consistent with real IDs?
   Answer: CLEAR or FLAGGED or UNCERTAIN

Respond in this exact format (three lines only):
QUALITY: <PASS|FAIL_BLURRY|FAIL_PARTIAL>
AUTHENTICITY: <CLEAR|FLAGGED|UNCERTAIN>
NOTE: <one sentence explanation, max 100 chars>`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const qualityMatch = text.match(/QUALITY:\s*(PASS|FAIL_BLURRY|FAIL_PARTIAL)/i)
    const authMatch = text.match(/AUTHENTICITY:\s*(CLEAR|FLAGGED|UNCERTAIN)/i)
    const noteMatch = text.match(/NOTE:\s*(.+)/i)

    ai_quality_result = (qualityMatch?.[1]?.toLowerCase() ?? 'pass') as typeof ai_quality_result
    ai_authenticity_flag = (authMatch?.[1]?.toLowerCase() ?? 'clear') as typeof ai_authenticity_flag
    ai_validation_notes = noteMatch?.[1]?.trim() ?? ''
  } catch (err) {
    console.error('validate-id: Claude API error:', err)
    ai_quality_result = 'pass'
    ai_authenticity_flag = 'uncertain'
    ai_validation_notes = 'AI validation unavailable — manual review required'
  }

  const { data: application } = await supabase
    .from('booking_applications')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (!application) {
    return NextResponse.json({ error: 'Application not started — call POST /application first' }, { status: 400 })
  }

  const { data: docRow, error: docError } = await supabase
    .from('guest_id_documents')
    .upsert(
      {
        application_id: application.id,
        booking_id: bookingId,
        guest_index,
        guest_name,
        current_address,
        id_photo_url,
        ai_quality_result,
        ai_authenticity_flag,
        ai_validation_notes,
        ai_validated_at: new Date().toISOString(),
      },
      { onConflict: 'application_id,guest_index' }
    )
    .select()
    .single()

  if (docError) {
    console.error('validate-id: failed to save doc:', docError)
    return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
  }

  return NextResponse.json({
    document: docRow,
    quality_passed: ai_quality_result === 'pass',
    quality_error:
      ai_quality_result === 'fail_blurry'
        ? 'Your ID photo is blurry. Please retake in good lighting and ensure text is readable.'
        : ai_quality_result === 'fail_partial'
        ? 'Your ID is partially cropped. Please ensure the full ID is visible in the frame.'
        : null,
  })
}
