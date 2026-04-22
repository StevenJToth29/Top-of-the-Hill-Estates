# AI Prompts Settings — Design Spec
**Date:** 2026-04-22

## Overview

Make all AI copywriting prompts editable by admins via the Settings page. Currently the system prompt and four field-type user prompts are hardcoded in the generate route. This feature stores them in the database and surfaces them in a new AI Prompts tab in a refactored tabbed Settings page.

---

## Settings Page Refactor

The Settings page gains a `FormTabBar` (same component used in `PropertyForm` and `RoomForm`) with three tabs:

| Tab | Contents |
|-----|----------|
| **General** | Logo, Favicon, Business Name, About Us, Contact Info, Business Hours |
| **Booking** | House Rules, Check-in/out Times, Cancellation Policy, Payment Processing, Payment Methods |
| **AI Prompts** | System prompt + 4 field-type user prompts |

The tab bar renders at the top of `SettingsForm`. A `tab` state (`'general' | 'booking' | 'ai'`) controls which sections are visible. Existing sections are assigned to tabs — no sections are removed or restructured.

---

## Storage

**Migration:** `022_ai_prompts.sql` — adds a nullable JSONB column `ai_prompts` to `site_settings`.

```sql
ALTER TABLE site_settings ADD COLUMN ai_prompts jsonb;
```

**Shape of the JSONB value:**
```ts
{
  system_prompt: string
  property_description: string
  room_description: string
  short_description: string
  about_us: string
}
```

No default is set. The generate route falls back to hardcoded strings when the column is null or a key is missing — existing behavior is fully preserved until an admin explicitly saves custom prompts.

---

## Type Changes

`SiteSettings` interface (`types/index.ts`) gains:
```ts
ai_prompts?: string | null  // JSON-encoded AiPrompts object
```

New exported interface:
```ts
export interface AiPrompts {
  system_prompt?: string
  property_description?: string
  room_description?: string
  short_description?: string
  about_us?: string
}
```

---

## API Changes

### `app/api/admin/settings/route.ts`
Add `ai_prompts` to the field allowlist (same pattern as `cancellation_policy`):
```ts
if (body.ai_prompts !== undefined) fields.ai_prompts = body.ai_prompts
```

### `app/api/admin/ai/generate/route.ts`
At the top of the POST handler:
1. Create a Supabase service-role client
2. Fetch `ai_prompts` from `site_settings` (`.select('ai_prompts').single()`)
3. Parse the JSON — fall back to an empty object on null/parse error
4. For each prompt (system + per field type), use the stored value if non-empty, otherwise use the existing hardcoded string

---

## UI — AI Prompts Tab

Five labeled `<textarea>` fields:

| Field | Label | Rows |
|-------|-------|------|
| `system_prompt` | System Prompt | 5 |
| `property_description` | Property Description Prompt | 4 |
| `room_description` | Room Description Prompt | 4 |
| `short_description` | Short Description Prompt | 4 |
| `about_us` | About Us Prompt | 4 |

Each textarea shows a helper line below it:
> *Available variables: `{context}` (property/room details), `{hint}` (omitted if blank)*

The generate route substitutes `{context}` with the actual context string and `{hint}` with `Additional instructions: <hint>` when a hint is provided, or removes the `{hint}` token entirely when absent.

The `ai_prompts` object is managed as a single state value in `SettingsForm`, serialized to JSON and included in the existing `handleSubmit` PATCH call. No separate save button is needed.

Placeholder text for each field shows the current hardcoded prompt so admins can see what the default is before editing.

---

## Data Flow

```
Settings page (server) → fetches site_settings including ai_prompts
  → passes to SettingsForm as prop

SettingsForm (client) → parses ai_prompts JSON into state
  → user edits prompts in AI tab
  → handleSubmit serializes back to JSON, sends in PATCH body

settings/route.ts → saves ai_prompts column to site_settings

ai/generate/route.ts → on each generation request:
  → fetches ai_prompts from site_settings
  → merges with hardcoded defaults (stored value wins if non-empty)
  → passes to Anthropic SDK
```

---

## Files Affected

| File | Change |
|------|--------|
| `supabase/migrations/022_ai_prompts.sql` | New — adds `ai_prompts` column |
| `types/index.ts` | Add `ai_prompts` to `SiteSettings`, add `AiPrompts` interface |
| `app/api/admin/settings/route.ts` | Add `ai_prompts` to allowlist |
| `app/api/admin/ai/generate/route.ts` | Read prompts from DB with fallback |
| `app/admin/(protected)/settings/page.tsx` | Pass `ai_prompts` field through to `SettingsForm` |
| `components/admin/SettingsForm.tsx` | Add tab state, `FormTabBar`, AI Prompts tab with 5 textareas |

---

## Out of Scope

- Per-property or per-room prompt overrides
- Prompt versioning or history
- Preview/test generation from the settings page
