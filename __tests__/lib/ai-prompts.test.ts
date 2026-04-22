/** @jest-environment node */
import {
  resolvePrompts,
  applyTemplate,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPTS,
} from '@/lib/ai-prompts'

describe('resolvePrompts', () => {
  it('returns hardcoded defaults when stored is null', () => {
    const { systemPrompt, userPrompts } = resolvePrompts(null)
    expect(systemPrompt).toBe(DEFAULT_SYSTEM_PROMPT)
    expect(userPrompts.property_description).toBe(DEFAULT_USER_PROMPTS.property_description)
    expect(userPrompts.room_description).toBe(DEFAULT_USER_PROMPTS.room_description)
    expect(userPrompts.short_description).toBe(DEFAULT_USER_PROMPTS.short_description)
    expect(userPrompts.about_us).toBe(DEFAULT_USER_PROMPTS.about_us)
  })

  it('uses stored system prompt when non-empty', () => {
    const { systemPrompt } = resolvePrompts({ system_prompt: 'Custom system' })
    expect(systemPrompt).toBe('Custom system')
  })

  it('uses stored user prompt when non-empty', () => {
    const { userPrompts } = resolvePrompts({ property_description: 'Custom property prompt' })
    expect(userPrompts.property_description).toBe('Custom property prompt')
  })

  it('falls back to default for empty string fields', () => {
    const { systemPrompt, userPrompts } = resolvePrompts({
      system_prompt: '',
      property_description: '   ',
    })
    expect(systemPrompt).toBe(DEFAULT_SYSTEM_PROMPT)
    expect(userPrompts.property_description).toBe(DEFAULT_USER_PROMPTS.property_description)
  })

  it('mixes stored and default values', () => {
    const { systemPrompt, userPrompts } = resolvePrompts({ system_prompt: 'Custom' })
    expect(systemPrompt).toBe('Custom')
    expect(userPrompts.about_us).toBe(DEFAULT_USER_PROMPTS.about_us)
  })
})

describe('applyTemplate', () => {
  it('substitutes {context}', () => {
    const result = applyTemplate('Context: {context}', 'my context')
    expect(result).toBe('Context: my context')
  })

  it('substitutes {hint} with formatted string when hint provided', () => {
    const result = applyTemplate('{hint}', 'ctx', 'be brief')
    expect(result).toBe('Additional instructions: be brief')
  })

  it('replaces {hint} with empty string when hint is absent', () => {
    const result = applyTemplate('A\n{hint}\nB', 'ctx')
    expect(result).toContain('A')
    expect(result).toContain('B')
    expect(result).not.toContain('{hint}')
  })

  it('trims the result', () => {
    const result = applyTemplate('  text  ', 'ctx')
    expect(result).toBe('text')
  })
})
