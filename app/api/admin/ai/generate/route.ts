import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import { resolvePrompts, applyTemplate, DEFAULT_FALLBACK_PROMPT } from '@/lib/ai-prompts'
import type { AiPrompts } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const serverClient = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await serverClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { fieldType?: string; context?: string; hint?: string; imageUrl?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { fieldType, context, hint, imageUrl } = body

  if (typeof context === 'string' && context.length > 4000) {
    return new Response(JSON.stringify({ error: 'context too long' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (typeof hint === 'string' && hint.length > 500) {
    return new Response(JSON.stringify({ error: 'hint too long' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createServiceRoleClient()
  const { data: settingsData } = await supabase
    .from('site_settings')
    .select('ai_prompts')
    .single()

  let storedPrompts: AiPrompts | null = null
  if (settingsData?.ai_prompts) {
    try {
      storedPrompts = JSON.parse(settingsData.ai_prompts as string) as AiPrompts
    } catch {
      // fall back to defaults
    }
  }

  const { systemPrompt, userPrompts } = resolvePrompts(storedPrompts)

  let userPromptTemplate: string
  if (fieldType === 'short_description') {
    userPromptTemplate = userPrompts.short_description
  } else if (fieldType === 'room_description') {
    userPromptTemplate = userPrompts.room_description
  } else if (fieldType === 'property_description') {
    userPromptTemplate = userPrompts.property_description
  } else if (fieldType === 'about_us') {
    userPromptTemplate = userPrompts.about_us
  } else {
    userPromptTemplate = DEFAULT_FALLBACK_PROMPT
  }

  const userPrompt = applyTemplate(userPromptTemplate, context ?? '', hint)

  const messageContent = imageUrl
    ? [
        { type: 'image' as const, source: { type: 'url' as const, url: imageUrl } },
        { type: 'text' as const, text: userPrompt },
      ]
    : userPrompt

  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: fieldType === 'about_us' ? 600 : 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: messageContent }],
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
