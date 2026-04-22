import type { AiPrompts } from '@/types'

export const DEFAULT_SYSTEM_PROMPT = `You are a copywriter for a short-term and long-term rental property platform called Top of the Hill Estates.
Write compelling, accurate descriptions that highlight the best features of the property or room.
Be warm, inviting, and professional. Use concise, vivid language. Do not use markdown formatting.
Never fabricate features that aren't mentioned in the context.`

export const DEFAULT_USER_PROMPTS: Required<Omit<AiPrompts, 'system_prompt'>> = {
  short_description: `Write a short description (1–2 sentences, max 150 characters) for a rental room listing.
Context about the room:
{context}
{hint}
Reply with only the short description text, nothing else.`,
  room_description: `Write a full description (2–4 sentences) for a rental room listing.
Context about the room:
{context}
{hint}
Reply with only the description text, nothing else.`,
  property_description: `Write a full description (2–4 sentences) for a rental property listing.
Context about the property:
{context}
{hint}
Reply with only the description text, nothing else.`,
  about_us: `Write an "About Us" paragraph (3–5 sentences) for the following short-term and long-term rental business.
This text will appear on the public website to introduce the company to prospective guests.
Be warm, trustworthy, and welcoming. Highlight what makes this property management company special.
Context about the business:
{context}
{hint}
Reply with only the About Us text, nothing else.`,
}

export const DEFAULT_FALLBACK_PROMPT = `Write a description for a rental listing.
Context:
{context}
{hint}
Reply with only the description text, nothing else.`

export function resolvePrompts(stored: AiPrompts | null): {
  systemPrompt: string
  userPrompts: Required<Omit<AiPrompts, 'system_prompt'>>
} {
  return {
    systemPrompt: stored?.system_prompt?.trim() || DEFAULT_SYSTEM_PROMPT,
    userPrompts: {
      short_description: stored?.short_description?.trim() || DEFAULT_USER_PROMPTS.short_description,
      room_description: stored?.room_description?.trim() || DEFAULT_USER_PROMPTS.room_description,
      property_description: stored?.property_description?.trim() || DEFAULT_USER_PROMPTS.property_description,
      about_us: stored?.about_us?.trim() || DEFAULT_USER_PROMPTS.about_us,
    },
  }
}

export function applyTemplate(template: string, context: string, hint?: string): string {
  return template
    .replace(/\{context\}/g, context ?? '')
    .replace(/\{hint\}/g, hint ? `Additional instructions: ${hint}` : '')
    .trim()
}
