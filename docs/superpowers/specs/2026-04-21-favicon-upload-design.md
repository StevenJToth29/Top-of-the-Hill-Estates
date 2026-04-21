# Favicon Upload — Design Spec
**Date:** 2026-04-21

## Overview
Add a favicon upload feature to the admin settings page. Admin uploads one source image; the browser generates three PNG variants (32×32, 192×192, 180×180) via the Canvas API and uploads them to Supabase Storage. The three URLs are stored in `site_settings` and rendered in the Next.js app layout.

---

## Data Layer

### Migration: `018_favicon_urls.sql`
Add three nullable TEXT columns to `site_settings`:
- `favicon_url` — 32×32 PNG, used as the browser tab icon
- `favicon_large_url` — 192×192 PNG, used for Android/PWA manifest icon
- `favicon_apple_url` — 180×180 PNG, used as Apple Touch Icon

### TypeScript: `SiteSettings` interface (`types/index.ts`)
Add the three new optional fields:
```ts
favicon_url?: string
favicon_large_url?: string
favicon_apple_url?: string
```

### API
The existing settings PATCH route (`app/api/admin/settings/route.ts`) uses `update(body)` generically — no changes needed. The three new fields pass through automatically.

---

## Upload Flow

### Location
New "Favicon" section added to `SettingsForm.tsx`, positioned below the existing logo upload section.

### UI
- Single file input accepting PNG, JPEG, WebP, SVG
- On file selection, show a small 32×32 preview
- Uploaded state shows the preview with a "Remove" / "Replace" option
- Saving happens via the existing "Save Settings" button (no separate save)

### Client-side processing (Canvas API)
On file selection:
1. Load the image into an `HTMLImageElement`
2. Draw to canvas at each target size: 32×32, 192×192, 180×180
3. Export each canvas as a PNG blob via `canvas.toBlob('image/png')`
4. Upload all three blobs to Supabase Storage (`site-assets` bucket):
   - `favicon/32-{timestamp}.png`
   - `favicon/192-{timestamp}.png`
   - `favicon/180-{timestamp}.png`
5. Store the three public URLs in form state fields `favicon_url`, `favicon_large_url`, `favicon_apple_url`

No server-side image processing. No new dependencies. Follows existing `compressImage` + Supabase upload pattern.

---

## Rendering

### `app/layout.tsx`
The layout already fetches `site_settings` for the logo. Extend the `metadata` export to include favicon links:

```ts
icons: {
  icon: settings?.favicon_url ?? '/favicon.ico',
  apple: settings?.favicon_apple_url ?? '/favicon.ico',
  other: settings?.favicon_large_url
    ? [{ rel: 'icon', url: settings.favicon_large_url, sizes: '192x192', type: 'image/png' }]
    : [],
}
```

Falls back to `/favicon.ico` if no favicon has been uploaded yet.

---

## Error Handling
- Canvas resize or upload failure shows an inline error message in the favicon section (same pattern as logo upload errors)
- If only some of the three uploads succeed, the form does not update the URLs for that batch — the admin must retry

---

## Out of Scope
- True `.ico` binary container format
- Automated deletion of old favicon files from storage on replacement (same as existing logo upload behavior)
- Favicon manifest / `site.webmanifest` generation
