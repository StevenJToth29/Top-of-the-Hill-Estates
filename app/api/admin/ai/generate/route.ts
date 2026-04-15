import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await request.json()
  const { fieldType, context, hint } = body

  const systemPrompt = `You are a copywriter for a short-term and long-term rental property platform called Top of the Hill Estates.
Write compelling, accurate descriptions that highlight the best features of the property or room.
Be warm, inviting, and professional. Use concise, vivid language. Do not use markdown formatting.
Never fabricate features that aren't mentioned in the context.`

  let userPrompt = ''

  if (fieldType === 'short_description') {
    userPrompt = `Write a short description (1–2 sentences, max 150 characters) for a rental room listing.
Context about the room:
${context}
${hint ? `Additional instructions: ${hint}` : ''}
Reply with only the short description text, nothing else.`
  } else if (fieldType === 'room_description') {
    userPrompt = `Write a full description (2–4 sentences) for a rental room listing.
Context about the room:
${context}
${hint ? `Additional instructions: ${hint}` : ''}
Reply with only the description text, nothing else.`
  } else if (fieldType === 'property_description') {
    userPrompt = `Write a full description (2–4 sentences) for a rental property listing.
Context about the property:
${context}
${hint ? `Additional instructions: ${hint}` : ''}
Reply with only the description text, nothing else.`
  } else if (fieldType === 'about_us') {
    userPrompt = `Write an "About Us" paragraph (3–5 sentences) for the following short-term and long-term rental business.
This text will appear on the public website to introduce the company to prospective guests.
Be warm, trustworthy, and welcoming. Highlight what makes this property management company special.
Context about the business:
${context}
${hint ? `Additional instructions: ${hint}` : ''}
Reply with only the About Us text, nothing else.`
  } else {
    userPrompt = `Write a description for a rental listing.
Context:
${context}
${hint ? `Additional instructions: ${hint}` : ''}
Reply with only the description text, nothing else.`
  }

  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: fieldType === 'about_us' ? 600 : 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
