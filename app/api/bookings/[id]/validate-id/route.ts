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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params
  const supabase = createServiceRoleClient()

  const body = await req.json() as { guest_index: number; guest_name?: string; current_address?: string }
  const { guest_index, guest_name, current_address } = body

  const { data: application } = await supabase
    .from('booking_applications')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  const fields: Record<string, string> = {}
  if (guest_name !== undefined) fields.guest_name = guest_name
  if (current_address !== undefined) fields.current_address = current_address

  if (Object.keys(fields).length === 0) return NextResponse.json({ ok: true })

  const { error } = await supabase
    .from('guest_id_documents')
    .update(fields)
    .eq('application_id', application.id)
    .eq('guest_index', guest_index)

  if (error) {
    console.error('validate-id PATCH: failed to update:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
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

  if (image_base64.length > 6_900_000) {
    return NextResponse.json({ error: 'Image too large. Please use an image under 5 MB.' }, { status: 413 })
  }

  if (guest_index < 1 || guest_index > (booking.guest_count ?? 1)) {
    return NextResponse.json({ error: 'Invalid guest_index' }, { status: 400 })
  }

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  if (!allowedMimeTypes.includes(image_mime_type)) {
    return NextResponse.json({ error: 'Unsupported image type. Use JPEG, PNG, WebP, or HEIC.' }, { status: 400 })
  }

  let ai_quality_result: 'pass' | 'fail_blurry' | 'fail_partial' = 'pass'
  let ai_authenticity_flag: 'clear' | 'flagged' | 'uncertain' = 'clear'
  let ai_validation_notes = ''
  let extracted_name = ''
  let extracted_street = ''
  let extracted_city = ''
  let extracted_state = ''
  let extracted_zip = ''

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 768,
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
Accepted document types: driver's license, state ID card, or passport (any country).

Assess this image on FOUR dimensions AND extract personal information.

1. IMAGE QUALITY (hard gate):
   - Is the text readable and not blurry?
   - Is the full document visible without cropping?
   Answer: PASS or FAIL_BLURRY or FAIL_PARTIAL

2. AUTHENTICITY (soft flag for admin):
   - Does this appear to be a genuine government-issued document?
   - Are security features, layout, fonts, and formatting consistent with real IDs or passports?
   Answer: CLEAR or FLAGGED or UNCERTAIN

3. SCREEN DISPLAY DETECTION — be highly skeptical:
   Is this document being displayed on a screen (phone, tablet, computer) rather than being a physical card or booklet held up or placed flat?
   Look for ANY of these signs: visible screen bezels or device frame, pixel/LCD grid pattern, moire interference patterns, screen glare or reflections, color fringing, the document appearing to float on a dark background, unnatural contrast at the document border, or slight digital distortion of printed text.
   Even if the image looks clean, scrutinize carefully — modern phone screens can appear almost photographic.
   Answer: YES or NO or UNCERTAIN

4. AI-GENERATED FACE DETECTION — be highly skeptical:
   Does the ID photo (the portrait on the document) show signs of being AI-generated rather than a real photograph of a person?
   Look for ANY of these signs: skin that is unnaturally smooth or airbrushed with no pores or texture, hair edges that blend/blur into the background rather than showing individual strands, eyes that are perfectly symmetrical or have unnatural catchlights, facial features that are subtly asymmetric in an uncanny way, teeth that are unnaturally uniform, background that bleeds into or around the face edges, an overall "too perfect" or plastic appearance, or a face that does not match realistic photography grain/noise.
   Be especially suspicious of portraits that look professional-studio-quality — real ID and passport photos have natural imperfections.
   Answer: YES or NO or UNCERTAIN

5. EXTRACTED INFO (read directly from the document; use UNKNOWN if not visible or not applicable):

   NAME — construct the full name in "Given Names Surname" order:
   - Driver's license / state ID: read the name field directly as printed.
   - Passport (visual zone): combine the SURNAME and GIVEN NAMES fields printed in the data page.
   - Passport (MRZ fallback): if the visual zone is unclear, read the MRZ bottom lines. The MRZ surname and given names are separated by "<<"; replace any remaining "<" with a space. Reconstruct as "Given Names Surname".
   - Output a single clean string, no angle brackets, no "<" characters.

   ADDRESS — driver's license / state ID only:
   - Street address line (number + street name)
   - City
   - State (2-letter abbreviation)
   - ZIP/postal code
   - If the document is a passport, output UNKNOWN for all address fields (passports do not contain an address).

Respond in this exact format (10 lines only):
QUALITY: <PASS|FAIL_BLURRY|FAIL_PARTIAL>
AUTHENTICITY: <CLEAR|FLAGGED|UNCERTAIN>
SCREEN_DISPLAY: <YES|NO|UNCERTAIN>
AI_FACE: <YES|NO|UNCERTAIN>
NOTE: <one sentence combining your most important concern, max 120 chars>
NAME: <full name in Given Names Surname order, or UNKNOWN>
ADDRESS_STREET: <street address or UNKNOWN>
ADDRESS_CITY: <city or UNKNOWN>
ADDRESS_STATE: <2-letter state or UNKNOWN>
ADDRESS_ZIP: <zip code or UNKNOWN>`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const qualityMatch      = text.match(/QUALITY:\s*(PASS|FAIL_BLURRY|FAIL_PARTIAL)/i)
    const authMatch         = text.match(/AUTHENTICITY:\s*(CLEAR|FLAGGED|UNCERTAIN)/i)
    const screenMatch       = text.match(/SCREEN_DISPLAY:\s*(YES|NO|UNCERTAIN)/i)
    const aiFaceMatch       = text.match(/AI_FACE:\s*(YES|NO|UNCERTAIN)/i)
    const noteMatch         = text.match(/NOTE:\s*(.+)/i)
    const nameMatch         = text.match(/NAME:\s*(.+)/i)
    const streetMatch       = text.match(/ADDRESS_STREET:\s*(.+)/i)
    const cityMatch         = text.match(/ADDRESS_CITY:\s*(.+)/i)
    const stateMatch        = text.match(/ADDRESS_STATE:\s*(.+)/i)
    const zipMatch          = text.match(/ADDRESS_ZIP:\s*(.+)/i)

    ai_quality_result = (qualityMatch?.[1]?.toLowerCase() ?? 'pass') as 'pass' | 'fail_blurry' | 'fail_partial'

    const screenDisplay = screenMatch?.[1]?.toUpperCase() ?? 'NO'
    const aiFace        = aiFaceMatch?.[1]?.toUpperCase() ?? 'NO'
    const baseAuth      = (authMatch?.[1]?.toLowerCase() ?? 'clear') as 'clear' | 'flagged' | 'uncertain'

    // Screen-displayed or AI-generated face always escalates to flagged; uncertain signals → uncertain (unless already flagged)
    if (screenDisplay === 'YES' || aiFace === 'YES' || baseAuth === 'flagged') {
      ai_authenticity_flag = 'flagged'
    } else if (screenDisplay === 'UNCERTAIN' || aiFace === 'UNCERTAIN' || baseAuth === 'uncertain') {
      ai_authenticity_flag = 'uncertain'
    } else {
      ai_authenticity_flag = 'clear'
    }

    const concerns: string[] = []
    if (screenDisplay === 'YES') concerns.push('screen display')
    if (screenDisplay === 'UNCERTAIN') concerns.push('possible screen display')
    if (aiFace === 'YES') concerns.push('AI-generated face photo')
    if (aiFace === 'UNCERTAIN') concerns.push('possible AI-generated face photo')
    const baseNote = noteMatch?.[1]?.trim() ?? ''
    ai_validation_notes = concerns.length
      ? `[${concerns.join('; ')}] ${baseNote}`.trim()
      : baseNote

    const clean = (v: string | undefined) => { const s = v?.trim() ?? ''; return s === 'UNKNOWN' ? '' : s }
    extracted_name   = clean(nameMatch?.[1])
    extracted_street = clean(streetMatch?.[1])
    extracted_city   = clean(cityMatch?.[1])
    extracted_state  = clean(stateMatch?.[1])
    extracted_zip    = clean(zipMatch?.[1])
  } catch (err) {
    console.error('validate-id: Claude API error:', err)
    ai_quality_result = 'pass'
    ai_authenticity_flag = 'uncertain'
    ai_validation_notes = 'AI validation unavailable — manual review required'
  }

  // Use AI-extracted values; fall back to client-provided if extraction was unavailable
  const final_guest_name = extracted_name || guest_name
  const final_current_address = [extracted_street, extracted_city, extracted_state, extracted_zip]
    .filter(Boolean).join(', ') || current_address

  const { data: application } = await supabase
    .from('booking_applications')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (!application) {
    return NextResponse.json({ error: 'Application not started — call POST /application first' }, { status: 400 })
  }

  // Upload image to private storage bucket for admin review
  const fileBuffer = Buffer.from(image_base64, 'base64')
  const { error: uploadError } = await supabase.storage
    .from('id-documents')
    .upload(id_photo_url, fileBuffer, { contentType: image_mime_type, upsert: true })
  if (uploadError) {
    console.error('validate-id: storage upload error:', uploadError)
  }

  const { data: docRow, error: docError } = await supabase
    .from('guest_id_documents')
    .upsert(
      {
        application_id: application.id,
        booking_id: bookingId,
        guest_index,
        guest_name: final_guest_name,
        current_address: final_current_address,
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
    extracted: {
      name: extracted_name,
      address_street: extracted_street,
      address_city: extracted_city,
      address_state: extracted_state,
      address_zip: extracted_zip,
    },
  })
}
