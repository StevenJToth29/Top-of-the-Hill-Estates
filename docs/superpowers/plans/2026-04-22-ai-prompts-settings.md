# AI Prompts Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store AI copywriting prompts in `site_settings` and expose them as an editable "AI Prompts" tab in a refactored tabbed Settings page.

**Architecture:** Add a `TEXT` column `ai_prompts` to `site_settings` (JSON-encoded), extract a `lib/ai-prompts.ts` helper with tested fallback logic, wire the generate route to load prompts from DB, and refactor `SettingsForm` to use `FormTabBar` with General / Booking / AI Prompts tabs.

**Tech Stack:** Next.js App Router, Supabase (service-role client), React state, `FormTabBar` component (already in codebase), `@anthropic-ai/sdk`, Jest for unit tests.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/022_ai_prompts.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/022_ai_prompts.sql
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS ai_prompts TEXT;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Run via the `mcp__supabase__apply_migration` tool with name `022_ai_prompts` and the SQL above.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/022_ai_prompts.sql
git commit -m "feat: add ai_prompts column to site_settings"
```

---

### Task 2: Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add `AiPrompts` interface and update `SiteSettings`**

In `types/index.ts`, add the new interface immediately before `SiteSettings`:

```ts
export interface AiPrompts {
  system_prompt?: string
  property_description?: string
  room_description?: string
  short_description?: string
  about_us?: string
}
```

Then add this field to the `SiteSettings` interface (after `cancellation_policy`):

```ts
  ai_prompts?: string | null  // JSON-encoded AiPrompts
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add AiPrompts type and ai_prompts to SiteSettings"
```

---

### Task 3: `lib/ai-prompts.ts` — write the test first

**Files:**
- Create: `lib/ai-prompts.ts`
- Create: `__tests__/lib/ai-prompts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/ai-prompts.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx jest __tests__/lib/ai-prompts.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '@/lib/ai-prompts'`

- [ ] **Step 3: Create `lib/ai-prompts.ts`**

```ts
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
    .replace('{context}', context ?? '')
    .replace('{hint}', hint ? `Additional instructions: ${hint}` : '')
    .trim()
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx jest __tests__/lib/ai-prompts.test.ts --no-coverage
```

Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/ai-prompts.ts __tests__/lib/ai-prompts.test.ts
git commit -m "feat: add ai-prompts helper with resolve and template logic"
```

---

### Task 4: Settings API — add `ai_prompts` to allowlist

**Files:**
- Modify: `app/api/admin/settings/route.ts`

- [ ] **Step 1: Add the allowlist entry**

In `app/api/admin/settings/route.ts`, after the `cancellation_policy` allowlist line:

```ts
  if (body.cancellation_policy !== undefined) fields.cancellation_policy = body.cancellation_policy
```

Add:

```ts
  if (body.ai_prompts !== undefined) fields.ai_prompts = body.ai_prompts
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/settings/route.ts
git commit -m "feat: allow ai_prompts field in settings PATCH"
```

---

### Task 5: Generate route — load prompts from DB

**Files:**
- Modify: `app/api/admin/ai/generate/route.ts`

- [ ] **Step 1: Replace the file contents**

The entire file becomes:

```ts
import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceRoleClient } from '@/lib/supabase'
import { resolvePrompts, applyTemplate, DEFAULT_USER_PROMPTS } from '@/lib/ai-prompts'
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

  const body = await request.json()
  const { fieldType, context, hint, imageUrl } = body

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
    userPromptTemplate = `Write a description for a rental listing.\nContext:\n{context}\n{hint}\nReply with only the description text, nothing else.`
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
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/ai/generate/route.ts
git commit -m "feat: load AI prompts from DB in generate route with fallback"
```

---

### Task 6: Settings page — pass `ai_prompts` through

**Files:**
- Modify: `app/admin/(protected)/settings/page.tsx`

- [ ] **Step 1: Update the fallback object and prop**

In `app/admin/(protected)/settings/page.tsx`, the `fallback` object currently is:

```ts
  const fallback: SiteSettings = {
    id: '',
    business_name: 'Top of the Hill Rooms',
    about_text: '',
    contact_phone: '',
    contact_email: '',
    contact_address: '',
    updated_at: '',
  }
```

Add `ai_prompts: null` to it:

```ts
  const fallback: SiteSettings = {
    id: '',
    business_name: 'Top of the Hill Rooms',
    about_text: '',
    contact_phone: '',
    contact_email: '',
    contact_address: '',
    updated_at: '',
    ai_prompts: null,
  }
```

No other changes needed — `settingsResult.data` already passes all columns to `SettingsForm` via `settings={settingsResult.data ?? fallback}`.

- [ ] **Step 2: Commit**

```bash
git add app/admin/(protected)/settings/page.tsx
git commit -m "feat: include ai_prompts in settings page fallback"
```

---

### Task 7: SettingsForm — tabs + AI Prompts tab

**Files:**
- Modify: `components/admin/SettingsForm.tsx`

This task restructures the form into three tabs. Make the changes below in order.

- [ ] **Step 1: Add imports and type**

At the top of the file, add the import for `FormTabBar` and `AiPrompts`:

```ts
import FormTabBar from './FormTabBar'
import type { AiPrompts } from '@/types'
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPTS } from '@/lib/ai-prompts'
```

- [ ] **Step 2: Add tab state and aiPrompts state**

Inside the `SettingsForm` component, after the existing state declarations, add:

```ts
type SettingsTab = 'general' | 'booking' | 'ai'
const [tab, setTab] = useState<SettingsTab>('general')

const [aiPrompts, setAiPrompts] = useState<AiPrompts>(() => {
  if (!settings.ai_prompts) return {}
  try { return JSON.parse(settings.ai_prompts) as AiPrompts } catch { return {} }
})
```

- [ ] **Step 3: Define the tabs array**

After the state block, add:

```ts
const settingsTabs = [
  { id: 'general', label: 'General', icon: '⚙' },
  { id: 'booking', label: 'Booking', icon: '📋' },
  { id: 'ai', label: 'AI Prompts', icon: '✨' },
]
```

- [ ] **Step 4: Add `ai_prompts` to `handleSubmit`**

In `handleSubmit`, update the fetch body to include `ai_prompts`:

```ts
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          business_hours: JSON.stringify(hours),
          global_house_rules: form.global_house_rules,
          cancellation_policy: JSON.stringify(cancellationPolicy),
          ai_prompts: JSON.stringify(aiPrompts),
        }),
      })
```

- [ ] **Step 5: Replace the return statement**

Replace the entire `return (...)` block with:

```tsx
  return (
    <>
      <FormTabBar
        tabs={settingsTabs}
        active={tab}
        onChange={(id) => setTab(id as SettingsTab)}
      />

      <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl mt-6">

        {/* ── Tab: General ── */}
        {tab === 'general' && (
          <>
            {/* Logo */}
            <section className="space-y-4">
              <h2 className="font-display text-base font-semibold text-on-surface">Site Logo</h2>
              <div className="flex items-center gap-6">
                <div className="rounded-2xl bg-surface-container flex items-center justify-center shrink-0 p-1" style={{ width: form.logo_size + 16, height: form.logo_size + 16 }}>
                  <Image
                    src={form.logo_url || '/logo.png'}
                    alt="Current logo"
                    width={form.logo_size}
                    height={form.logo_size}
                    style={{ width: form.logo_size, height: form.logo_size }}
                    className="object-contain rounded-xl"
                    unoptimized={!!form.logo_url}
                  />
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={logoUploading}
                    onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-2 bg-surface-container hover:bg-surface-high text-on-surface-variant text-sm font-medium rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50"
                  >
                    <PhotoIcon className="w-4 h-4" />
                    {logoUploading ? 'Uploading…' : 'Upload New Logo'}
                  </button>
                  <p className="text-xs text-on-surface-variant/60">
                    PNG or SVG recommended · Max 400px · Displayed site-wide
                  </p>
                  {logoError && <p className="text-xs text-error">{logoError}</p>}
                </div>
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
              </div>
              {form.logo_url && form.logo_url !== settings.logo_url && (
                <p className="text-xs text-secondary">Logo uploaded — click Save Settings below to apply it site-wide.</p>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>Logo Size</label>
                  <span className="text-xs text-on-surface-variant">{form.logo_size}px</span>
                </div>
                <input type="range" min={32} max={96} step={4} value={form.logo_size} onChange={(e) => setForm((prev) => ({ ...prev, logo_size: Number(e.target.value) }))} className="w-full accent-primary" />
                <div className="flex justify-between text-xs text-on-surface-variant/50">
                  <span>Small</span><span>Large</span>
                </div>
              </div>
            </section>

            <div className="h-px bg-outline-variant" />

            {/* Favicon */}
            <section className="space-y-4">
              <h2 className="font-display text-base font-semibold text-on-surface">Favicon</h2>
              <div className="flex items-center gap-6">
                <div className="rounded-xl bg-surface-container flex items-center justify-center shrink-0" style={{ width: 48, height: 48 }}>
                  {form.favicon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.favicon_url} alt="Favicon preview" width={32} height={32} className="object-contain" />
                  ) : (
                    <span className="text-on-surface-variant/40 text-xs">No icon</span>
                  )}
                </div>
                <div className="space-y-2">
                  <button type="button" disabled={faviconUploading} onClick={() => faviconInputRef.current?.click()} className="flex items-center gap-2 bg-surface-container hover:bg-surface-high text-on-surface-variant text-sm font-medium rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50">
                    <PhotoIcon className="w-4 h-4" />
                    {faviconUploading ? 'Uploading…' : 'Upload Favicon'}
                  </button>
                  <p className="text-xs text-on-surface-variant/60">PNG, JPEG or WebP · Square image recommended · Generates 32px, 192px and 180px variants automatically</p>
                  {faviconError && <p className="text-xs text-error">{faviconError}</p>}
                </div>
                <input ref={faviconInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFaviconUpload} />
              </div>
              {form.favicon_url && form.favicon_url !== settings.favicon_url && (
                <p className="text-xs text-secondary">Favicon saved — refresh the page to see it in the browser tab.</p>
              )}
            </section>

            <div className="h-px bg-outline-variant" />

            {/* Business info */}
            <section className="space-y-5">
              <h2 className="font-display text-base font-semibold text-on-surface">Business Info</h2>
              <div>
                <label htmlFor="business_name" className={labelClass}>Business Name</label>
                <input id="business_name" name="business_name" type="text" value={form.business_name} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label htmlFor="about_text" className={labelClass}>About Us Text</label>
                <textarea id="about_text" name="about_text" rows={6} value={form.about_text} onChange={handleChange} className={`${inputClass} resize-y`} />
                <div className="mt-2">
                  <AIWriteButton
                    fieldType="about_us"
                    context={[
                      form.business_name && `Business name: ${form.business_name}`,
                      form.contact_address && `Address: ${form.contact_address}`,
                      form.contact_phone && `Phone: ${form.contact_phone}`,
                      form.contact_email && `Email: ${form.contact_email}`,
                      'Type of business: short-term and long-term residential rentals',
                    ].filter(Boolean).join('\n')}
                    onAccept={(text) => { setForm((prev) => ({ ...prev, about_text: text })); setSaved(false) }}
                  />
                </div>
              </div>
            </section>

            <div className="h-px bg-outline-variant" />

            {/* Contact info */}
            <section className="space-y-5">
              <h2 className="font-display text-base font-semibold text-on-surface">Contact Info</h2>
              <div>
                <label htmlFor="contact_phone" className={labelClass}>Phone</label>
                <input id="contact_phone" name="contact_phone" type="tel" value={form.contact_phone} onChange={handleChange} placeholder="(555) 555-5555" className={`${inputClass} ${fieldErrors.contact_phone ? 'ring-1 ring-error' : ''}`} />
                {fieldErrors.contact_phone && <p className="text-xs text-error mt-1">{fieldErrors.contact_phone}</p>}
              </div>
              <div>
                <label htmlFor="contact_email" className={labelClass}>Email</label>
                <input id="contact_email" name="contact_email" type="text" value={form.contact_email} onChange={handleChange} placeholder="you@example.com" className={`${inputClass} ${fieldErrors.contact_email ? 'ring-1 ring-error' : ''}`} />
                {fieldErrors.contact_email && <p className="text-xs text-error mt-1">{fieldErrors.contact_email}</p>}
              </div>
              <div>
                <label htmlFor="contact_address" className={labelClass}>Address</label>
                <textarea id="contact_address" name="contact_address" rows={2} value={form.contact_address} onChange={handleChange} className={`${inputClass} resize-y`} />
              </div>
            </section>

            <div className="h-px bg-outline-variant" />

            {/* Business hours */}
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-on-surface">Business Hours</h2>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">Displayed on your contact and about pages.</p>
              </div>
              <div className="space-y-2">
                {DAYS.map((day) => {
                  const dayHours = hours[day]
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <button type="button" onClick={() => setHours((prev) => ({ ...prev, [day]: { ...prev[day], closed: !prev[day].closed } }))} className={['relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary', dayHours.closed ? 'bg-surface-high' : 'bg-primary'].join(' ')} aria-label={`Toggle ${day}`}>
                        <span className={['inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform', dayHours.closed ? 'translate-x-0.5' : 'translate-x-4'].join(' ')} />
                      </button>
                      <span className="w-8 text-sm font-medium text-on-surface shrink-0">{day}</span>
                      {dayHours.closed ? (
                        <span className="text-sm text-on-surface-variant/50 italic">Closed</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <input type="time" value={dayHours.open} onChange={(e) => setHours((prev) => ({ ...prev, [day]: { ...prev[day], open: e.target.value } }))} className="bg-surface-highest/40 rounded-xl px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 [color-scheme:light]" />
                          <span className="text-on-surface-variant/50 text-sm">to</span>
                          <input type="time" value={dayHours.close} onChange={(e) => setHours((prev) => ({ ...prev, [day]: { ...prev[day], close: e.target.value } }))} className="bg-surface-highest/40 rounded-xl px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 [color-scheme:light]" />
                          {dayHours.open && dayHours.close && (
                            <span className="text-xs text-on-surface-variant/50 hidden sm:inline">{fmt12(dayHours.open)} – {fmt12(dayHours.close)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {/* ── Tab: Booking ── */}
        {tab === 'booking' && (
          <>
            {/* Global House Rules */}
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-on-surface">Global House Rules</h2>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">Default rules applied to all properties. Each property can override these with its own custom rules.</p>
              </div>
              <textarea id="global_house_rules" name="global_house_rules" rows={6} value={form.global_house_rules} onChange={handleChange} placeholder="No smoking, no parties, quiet hours after 10pm…" className={`${inputClass} resize-y`} />
            </section>

            <div className="h-px bg-outline-variant" />

            {/* Short-term Booking Times */}
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-on-surface">Short-term Booking Times</h2>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">Standard check-in and check-out times applied to all short-term listings.</p>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="checkin_time" className={labelClass}>Check-in Time</label>
                  <div className="flex items-center gap-3">
                    <input id="checkin_time" name="checkin_time" type="time" value={form.checkin_time} onChange={handleChange} className="bg-surface-highest/40 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 [color-scheme:light]" />
                    {form.checkin_time && <span className="text-sm text-on-surface-variant">{fmt12(form.checkin_time)}</span>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="checkout_time" className={labelClass}>Check-out Time</label>
                  <div className="flex items-center gap-3">
                    <input id="checkout_time" name="checkout_time" type="time" value={form.checkout_time} onChange={handleChange} className="bg-surface-highest/40 rounded-xl px-3 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 [color-scheme:light]" />
                    {form.checkout_time && <span className="text-sm text-on-surface-variant">{fmt12(form.checkout_time)}</span>}
                  </div>
                </div>
              </div>
            </section>

            <div className="h-px bg-outline-variant" />

            {/* Payment Processing */}
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-on-surface">Payment Processing</h2>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">Stripe&apos;s standard rate is 2.9% + $0.30 per transaction.</p>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="stripe_fee_percent" className={labelClass}>Processing fee (%)</label>
                  <input id="stripe_fee_percent" name="stripe_fee_percent" type="number" step="0.01" min="0" value={form.stripe_fee_percent} onChange={(e) => setForm((prev) => ({ ...prev, stripe_fee_percent: Number(e.target.value) }))} className={inputClass} />
                  <p className="text-xs text-on-surface-variant/50">e.g. 2.9 for 2.9%</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="stripe_fee_flat" className={labelClass}>Processing fee (flat, $)</label>
                  <input id="stripe_fee_flat" name="stripe_fee_flat" type="number" step="0.01" min="0" value={form.stripe_fee_flat} onChange={(e) => setForm((prev) => ({ ...prev, stripe_fee_flat: Number(e.target.value) }))} className={inputClass} />
                  <p className="text-xs text-on-surface-variant/50">e.g. 0.30 for $0.30</p>
                </div>
              </div>
            </section>

            <div className="h-px bg-outline-variant" />

            {/* Cancellation Policy */}
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-base font-semibold text-on-surface">Default Cancellation Policy</h2>
                <p className="text-xs text-on-surface-variant/60 mt-0.5">System-wide default applied to all rooms unless overridden at property or room level.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="full_refund_days" className={labelClass}>Full refund window (days)</label>
                  <input id="full_refund_days" type="number" min="0" step="1" value={cancellationPolicy.full_refund_days} onChange={(e) => setCancellationPolicy((p) => ({ ...p, full_refund_days: Number(e.target.value) }))} className={inputClass} />
                  <p className="text-xs text-on-surface-variant/50">e.g. 7 = full refund if cancelled &gt;7 days out</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="partial_refund_hours" className={labelClass}>Partial refund cutoff (hours)</label>
                  <input id="partial_refund_hours" type="number" min="0" step="1" value={cancellationPolicy.partial_refund_hours} onChange={(e) => setCancellationPolicy((p) => ({ ...p, partial_refund_hours: Number(e.target.value) }))} className={inputClass} />
                  <p className="text-xs text-on-surface-variant/50">e.g. 72 = partial% if &gt;72 hrs but within full window</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="partial_refund_percent" className={labelClass}>Partial refund amount (%)</label>
                  <input id="partial_refund_percent" type="number" min="0" max="100" step="1" value={cancellationPolicy.partial_refund_percent} onChange={(e) => setCancellationPolicy((p) => ({ ...p, partial_refund_percent: Number(e.target.value) }))} className={inputClass} />
                  <p className="text-xs text-on-surface-variant/50">e.g. 50 = 50% refund in the middle tier</p>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ── Tab: AI Prompts ── */}
        {tab === 'ai' && (
          <section className="space-y-6">
            <div>
              <h2 className="font-display text-base font-semibold text-on-surface">AI Prompts</h2>
              <p className="text-xs text-on-surface-variant/60 mt-0.5">
                Customise the prompts used when generating copy. Leave blank to use the built-in defaults.
                Available variables: <code className="text-secondary text-xs">{'{context}'}</code> (property/room details),{' '}
                <code className="text-secondary text-xs">{'{hint}'}</code> (admin hint, omitted if blank).
              </p>
            </div>

            {([
              { key: 'system_prompt' as const, label: 'System Prompt', rows: 5, placeholder: DEFAULT_SYSTEM_PROMPT },
              { key: 'property_description' as const, label: 'Property Description Prompt', rows: 4, placeholder: DEFAULT_USER_PROMPTS.property_description },
              { key: 'room_description' as const, label: 'Room Description Prompt', rows: 4, placeholder: DEFAULT_USER_PROMPTS.room_description },
              { key: 'short_description' as const, label: 'Short Description Prompt', rows: 4, placeholder: DEFAULT_USER_PROMPTS.short_description },
              { key: 'about_us' as const, label: 'About Us Prompt', rows: 4, placeholder: DEFAULT_USER_PROMPTS.about_us },
            ] as const).map(({ key, label, rows, placeholder }) => (
              <div key={key}>
                <label className={labelClass}>{label}</label>
                <textarea
                  rows={rows}
                  value={aiPrompts[key] ?? ''}
                  onChange={(e) => setAiPrompts((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className={`${inputClass} resize-y font-mono text-xs`}
                />
              </div>
            ))}
          </section>
        )}

        {/* Save button — always visible */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-gradient-to-r from-primary to-secondary text-background rounded-2xl px-6 py-2.5 font-semibold shadow-[0_0_10px_rgba(45,212,191,0.30)] disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && <span className="text-sm text-secondary">Settings saved.</span>}
          {error && <span className="text-sm text-error">{error}</span>}
        </div>
      </form>

      {/* Payment Methods — only shown on Booking tab */}
      {tab === 'booking' && (
        <div className="mt-8 space-y-6 max-w-2xl">
          <div>
            <h2 className="font-display text-lg font-semibold text-on-surface mb-1">Payment Methods</h2>
            <p className="text-on-surface-variant text-sm mb-6">Configure which payment methods guests can use and the processing fee for each.</p>
          </div>
          <div className="h-px bg-outline-variant" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderMethodSection('Short-term Bookings', 'short_term')}
            {renderMethodSection('Long-term Bookings', 'long_term')}
          </div>
        </div>
      )}
    </>
  )
```

- [ ] **Step 6: Commit**

```bash
git add components/admin/SettingsForm.tsx
git commit -m "feat: refactor SettingsForm with tabbed nav and AI Prompts tab"
```

---

### Task 8: Verify end-to-end

- [ ] **Step 1: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass including the new `ai-prompts` tests.

- [ ] **Step 2: Manual smoke test**

1. Navigate to `/admin/settings`
2. Confirm three tabs render: General, Booking, AI Prompts
3. Confirm General tab shows logo, favicon, business info, contact, hours
4. Confirm Booking tab shows house rules, booking times, payment processing, cancellation policy, payment methods
5. Confirm AI Prompts tab shows 5 textareas with placeholder text from the hardcoded defaults
6. Edit the "Property Description Prompt" textarea — type a custom prompt containing `{context}`
7. Click Save Settings — confirm "Settings saved." appears
8. Reload the page — confirm the custom prompt is still in the field
9. Go to a property, click the AI write button for description — confirm the custom prompt is used (check the generated text matches the style of your custom prompt)
10. Clear the field and save — confirm the hardcoded default is used again on next generation

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: address any issues found during smoke test"
```
