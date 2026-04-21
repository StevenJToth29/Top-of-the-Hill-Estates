# Favicon Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow the admin to upload a site favicon from the settings page; one source image is resized client-side to 32×32, 192×192, and 180×180 PNG variants, stored in Supabase Storage, and served via Next.js layout metadata.

**Architecture:** Three favicon URLs are added to `site_settings`. The upload happens entirely client-side using the Canvas API (same pattern as the existing logo upload). The root `app/layout.tsx` switches from a static `metadata` export to a `generateMetadata` async function that fetches the favicon URLs from the DB.

**Tech Stack:** Next.js 14 App Router, Supabase Storage (`site-assets` bucket), Canvas API, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/020_favicon_urls.sql` | CREATE — adds 3 columns to `site_settings` |
| `types/index.ts` | MODIFY — add 3 fields to `SiteSettings` interface |
| `components/admin/SettingsForm.tsx` | MODIFY — add favicon state, upload handler, UI section |
| `app/layout.tsx` | MODIFY — switch to `generateMetadata`, add icons |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/018_favicon_urls.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/020_favicon_urls.sql
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS favicon_url       text,
  ADD COLUMN IF NOT EXISTS favicon_large_url text,
  ADD COLUMN IF NOT EXISTS favicon_apple_url text;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool:
- name: `favicon_urls`
- query: the SQL above

Expected: `{ "success": true }`

- [ ] **Step 3: Verify columns exist**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'site_settings'
  AND column_name IN ('favicon_url', 'favicon_large_url', 'favicon_apple_url');
```

Expected: 3 rows returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/020_favicon_urls.sql
git commit -m "feat: add favicon URL columns to site_settings"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `types/index.ts` — `SiteSettings` interface

- [ ] **Step 1: Locate the SiteSettings interface**

It is in `types/index.ts`. Find the block that contains `logo_url?: string` and add three lines after it.

- [ ] **Step 2: Add the three new fields**

Find this section in the `SiteSettings` interface:
```ts
  logo_url?: string
  logo_size?: number
```

Add after `logo_size`:
```ts
  favicon_url?: string
  favicon_large_url?: string
  favicon_apple_url?: string
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts
git commit -m "feat: add favicon fields to SiteSettings type"
```

---

## Task 3: Favicon Upload in SettingsForm

**Files:**
- Modify: `components/admin/SettingsForm.tsx`

- [ ] **Step 1: Add favicon fields to form state**

In `SettingsForm.tsx`, find the `useState` call that initialises the form (around line 71). It currently ends with:
```ts
    stripe_fee_percent: settings.stripe_fee_percent ?? 2.9,
    stripe_fee_flat: settings.stripe_fee_flat ?? 0.30,
  })
```

Change to:
```ts
    stripe_fee_percent: settings.stripe_fee_percent ?? 2.9,
    stripe_fee_flat: settings.stripe_fee_flat ?? 0.30,
    favicon_url: settings.favicon_url ?? '',
    favicon_large_url: settings.favicon_large_url ?? '',
    favicon_apple_url: settings.favicon_apple_url ?? '',
  })
```

- [ ] **Step 2: Add favicon upload state variables and ref**

Find these existing lines (around line 94–96):
```ts
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)
```

Add directly after them:
```ts
  const [faviconUploading, setFaviconUploading] = useState(false)
  const [faviconError, setFaviconError] = useState('')
  const faviconInputRef = useRef<HTMLInputElement>(null)
```

- [ ] **Step 3: Add the canvas resize helper**

Find the existing `compressImage` function (around line 52). Add a new function directly after it:

```ts
async function resizeToPng(file: File, size: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, size, size)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob returned null'))
      }, 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}
```

- [ ] **Step 4: Add the favicon upload handler**

Find the existing `handleLogoUpload` function (around line 132). Add a new function directly after it:

```ts
  async function handleFaviconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFaviconUploading(true)
    setFaviconError('')
    try {
      const supabase = createClient()
      const ts = Date.now()
      const sizes: Array<{ key: 'favicon_url' | 'favicon_large_url' | 'favicon_apple_url'; size: number; name: string }> = [
        { key: 'favicon_url',       size: 32,  name: `favicon/32-${ts}.png`  },
        { key: 'favicon_large_url', size: 192, name: `favicon/192-${ts}.png` },
        { key: 'favicon_apple_url', size: 180, name: `favicon/180-${ts}.png` },
      ]

      const urls: Record<string, string> = {}

      for (const { key, size, name } of sizes) {
        const blob = await resizeToPng(file, size)
        const { data, error: uploadError } = await supabase.storage
          .from('site-assets')
          .upload(name, blob, { contentType: 'image/png', upsert: false })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(data.path)
        urls[key] = publicUrl
      }

      setForm((prev) => ({
        ...prev,
        favicon_url: urls.favicon_url,
        favicon_large_url: urls.favicon_large_url,
        favicon_apple_url: urls.favicon_apple_url,
      }))
      setSaved(false)
    } catch (err) {
      setFaviconError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setFaviconUploading(false)
      if (faviconInputRef.current) faviconInputRef.current.value = ''
    }
  }
```

- [ ] **Step 5: Add the favicon UI section**

Find the end of the logo section in the JSX (around line 393):
```tsx
      </section>

      <div className="h-px bg-outline-variant" />

      {/* Business info */}
```

Insert a new section between the divider and Business info:

```tsx
      {/* Favicon */}
      <section className="space-y-4">
        <h2 className="font-display text-base font-semibold text-on-surface">Favicon</h2>
        <div className="flex items-center gap-6">
          <div className="rounded-xl bg-surface-container flex items-center justify-center shrink-0" style={{ width: 48, height: 48 }}>
            {form.favicon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.favicon_url}
                alt="Favicon preview"
                width={32}
                height={32}
                className="object-contain"
              />
            ) : (
              <span className="text-on-surface-variant/40 text-xs">No icon</span>
            )}
          </div>
          <div className="space-y-2">
            <button
              type="button"
              disabled={faviconUploading}
              onClick={() => faviconInputRef.current?.click()}
              className="flex items-center gap-2 bg-surface-container hover:bg-surface-high text-on-surface-variant text-sm font-medium rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50"
            >
              <PhotoIcon className="w-4 h-4" />
              {faviconUploading ? 'Uploading…' : 'Upload Favicon'}
            </button>
            <p className="text-xs text-on-surface-variant/60">
              PNG, JPEG, WebP or SVG · Generates 32px, 192px and 180px variants automatically
            </p>
            {faviconError && (
              <p className="text-xs text-error">{faviconError}</p>
            )}
          </div>
          <input
            ref={faviconInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={handleFaviconUpload}
          />
        </div>
        {form.favicon_url && form.favicon_url !== settings.favicon_url && (
          <p className="text-xs text-secondary">
            Favicon uploaded — click Save Settings below to apply it site-wide.
          </p>
        )}
      </section>

      <div className="h-px bg-outline-variant" />
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/admin/SettingsForm.tsx
git commit -m "feat: add favicon upload section to admin settings"
```

---

## Task 4: Layout Metadata

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Rewrite layout.tsx to use generateMetadata**

Replace the entire contents of `app/layout.tsx` with:

```tsx
import type { Metadata } from 'next'
import { Manrope, Plus_Jakarta_Sans } from 'next/font/google'
import { createServiceRoleClient } from '@/lib/supabase'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createServiceRoleClient()
  const { data: settings } = await supabase
    .from('site_settings')
    .select('favicon_url, favicon_large_url, favicon_apple_url')
    .single()

  return {
    title: 'Top of the Hill Rooms',
    description:
      'Short-term and long-term room rentals in Mesa/Tempe, Arizona. Book directly with Top of the Hill Rooms.',
    icons: {
      icon: settings?.favicon_url ?? '/favicon.ico',
      apple: settings?.favicon_apple_url ?? '/favicon.ico',
      other: settings?.favicon_large_url
        ? [{ rel: 'icon', url: settings.favicon_large_url, sizes: '192x192', type: 'image/png' }]
        : [],
    },
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${plusJakartaSans.variable}`}>
      <body className="font-body bg-background text-on-surface antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: serve dynamic favicon from site_settings in root layout"
```

---

## Task 5: Manual Smoke Test

- [ ] **Step 1: Start dev server** (if not already running)

```bash
npm run dev
```

- [ ] **Step 2: Upload a favicon**

1. Open `/admin/settings`
2. Scroll to the new "Favicon" section
3. Click "Upload Favicon" and select any image file
4. Verify the 32×32 preview appears in the section
5. The "Favicon uploaded — click Save Settings below" notice appears

- [ ] **Step 3: Save and verify browser tab**

1. Click "Save Settings"
2. Hard-refresh any page (`Ctrl+Shift+R`)
3. Check the browser tab — it should show the uploaded favicon

- [ ] **Step 4: Verify fallback**

In the database, confirm that pages still load and show a favicon before upload (falls back to `/favicon.ico`).

---

## Self-Review Checklist

- [x] **Spec coverage:** Migration ✓, Types ✓, Upload flow ✓, Canvas resize ✓, 3-size variants ✓, Preview ✓, Layout metadata ✓, Fallback ✓
- [x] **No placeholders:** All code blocks are complete with exact implementations
- [x] **Type consistency:** `favicon_url`, `favicon_large_url`, `favicon_apple_url` used consistently across migration, types, form state, upload handler, and layout query
- [x] **State consistency:** `settings.favicon_url` (not `settings.favicon`) used in the "uploaded" notice, matching the field name in the SiteSettings type
