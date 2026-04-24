# Property Image Descriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to add a description to each photo in the property image library, and display those descriptions as captions in the room booking page gallery lightbox.

**Architecture:** `properties.images` is migrated from `text[]` to `jsonb` storing `[{url, description}]`. The `ImageUploader` component gains an inline description input per thumbnail. The public `ImageGallery` component receives a `descriptions` map and shows the caption in the lightbox. The room page already fetches `property:properties(*)` so descriptions are available with no extra query.

**Tech Stack:** Next.js App Router, Supabase (Postgres jsonb migration), React, Tailwind CSS

---

### Task 1: Database migration — `properties.images` text[] → jsonb

**Files:**
- No new files — use Supabase MCP to run migration SQL directly

- [ ] **Step 1: Run migration SQL**

Execute via Supabase MCP (`mcp__supabase__apply_migration` or `execute_sql`):

```sql
-- Migrate properties.images from text[] to jsonb [{url, description?}]
ALTER TABLE properties
  ALTER COLUMN images TYPE jsonb
  USING (
    CASE
      WHEN images IS NULL THEN '[]'::jsonb
      ELSE (
        SELECT jsonb_agg(jsonb_build_object('url', img))
        FROM unnest(images) AS img
      )
    END
  );

-- Set default to empty jsonb array
ALTER TABLE properties ALTER COLUMN images SET DEFAULT '[]'::jsonb;
```

- [ ] **Step 2: Verify migration**

```sql
SELECT id, name, jsonb_array_length(images) as count,
       images->0 as first_image
FROM properties
LIMIT 3;
```

Expected: each row shows `{"url": "https://..."}` objects, no `description` key yet (that's fine).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: migrate properties.images from text[] to jsonb with url/description shape"
```

---

### Task 2: TypeScript types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add `PropertyImage` type and update `Property`**

In `types/index.ts`, add before the `Property` interface and update it:

```ts
export interface PropertyImage {
  url: string
  description?: string
}
```

Change `Property.images`:
```ts
// Before:
images: string[]

// After:
images: PropertyImage[]
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v "test\|__tests__" | head -30
```

Fix any errors before continuing. Expected: errors only from files that still treat `images` as `string[]` (these will be fixed in subsequent tasks).

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add PropertyImage type, update Property.images to PropertyImage[]"
```

---

### Task 3: Update `ImageUploader` to handle `PropertyImage[]` with descriptions

**Files:**
- Modify: `components/admin/ImageUploader.tsx`

The uploader currently takes `images: string[]` and `onChange: (images: string[]) => void`. We change it to `PropertyImage[]` and add an inline description text input under each thumbnail.

- [ ] **Step 1: Update props interface**

Replace the existing `ImageUploaderProps`:

```ts
import type { PropertyImage } from '@/types'

interface ImageUploaderProps {
  images: PropertyImage[]
  bucket: string
  uploadFolder: string
  onChange: (images: PropertyImage[]) => void
}
```

- [ ] **Step 2: Update `uploadFiles` to push `PropertyImage` objects**

In the `uploadFiles` function, change `newUrls.push(publicUrl)` to push objects, and update the final `onChange` call:

```ts
// Replace:
const newUrls: string[] = []
// ...
newUrls.push(publicUrl)
// ...
onChange([...images, ...newUrls])

// With:
const newImages: PropertyImage[] = []
// ...
newImages.push({ url: publicUrl })
// ...
onChange([...images, ...newImages])
```

- [ ] **Step 3: Update `deleteImage` to work with objects**

```ts
// Replace:
async function deleteImage(url: string) {
  const supabase = createClient()
  const bucketMarker = `/object/public/${bucket}/`
  const idx = url.indexOf(bucketMarker)
  if (idx !== -1) {
    const path = url.slice(idx + bucketMarker.length)
    await supabase.storage.from(bucket).remove([path])
  }
  onChange(images.filter((img) => img !== url))
}

// With:
async function deleteImage(url: string) {
  const supabase = createClient()
  const bucketMarker = `/object/public/${bucket}/`
  const idx = url.indexOf(bucketMarker)
  if (idx !== -1) {
    const path = url.slice(idx + bucketMarker.length)
    await supabase.storage.from(bucket).remove([path])
  }
  onChange(images.filter((img) => img.url !== url))
}
```

- [ ] **Step 4: Update drag reorder to work with objects**

The drag handlers reference `images` (now `PropertyImage[]`). The reorder logic splices the array — it already works with any array type. Just ensure the `key` on each thumbnail uses `.url`:

```tsx
// In the grid map:
{images.map((img, i) => (
  <div key={img.url} ...>
```

- [ ] **Step 5: Update thumbnail image src and delete button**

All references to the URL value inside the map:

```tsx
// Replace:
{images.map((url, i) => (
  <div key={url} ...>
    <NextImage src={url} alt={`Image ${i + 1}`} .../>
    ...
    onClick={(e) => { e.stopPropagation(); deleteImage(url) }}
    ...
    onClick={(e) => { e.stopPropagation(); setLightboxIndex(i) }}
  </div>
))}

// With:
{images.map((img, i) => (
  <div key={img.url} ...>
    <NextImage src={img.url} alt={`Image ${i + 1}`} .../>
    ...
    onClick={(e) => { e.stopPropagation(); deleteImage(img.url) }}
    ...
    onClick={(e) => { e.stopPropagation(); setLightboxIndex(i) }}
  </div>
))}
```

- [ ] **Step 6: Add description input below each thumbnail**

Inside the per-thumbnail `<div>`, after the existing overlay, add a description input that appears below the image (outside the `aspect-video` overflow container). Change the thumbnail container from the current bare `<div>` approach to a wrapper that includes the input:

Replace the grid map block with:

```tsx
<div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2">
  {images.map((img, i) => (
    <div key={img.url} className="flex flex-col gap-1">
      {/* Image tile */}
      <div
        draggable
        onDragStart={(e) => handleImageDragStart(e, i)}
        onDragOver={(e) => handleImageDragOver(e, i)}
        onDrop={(e) => handleImageDrop(e, i)}
        onDragEnd={handleImageDragEnd}
        className={`relative group rounded-xl overflow-hidden bg-surface-container aspect-video cursor-grab active:cursor-grabbing transition-all duration-150 ${
          dragIndex === i
            ? 'opacity-40 scale-95'
            : dragOverIndex === i && dragIndex !== null
            ? 'ring-2 ring-secondary ring-offset-2 ring-offset-background scale-[1.02]'
            : ''
        }`}
      >
        <NextImage src={img.url} alt={`Image ${i + 1}`} fill className="object-cover pointer-events-none" />

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-container/80 backdrop-blur-sm">
            <Bars2Icon className="w-3.5 h-3.5 text-on-surface-variant/60 mx-0.5" title="Drag to reorder" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(i) }}
              className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-high transition-colors"
              aria-label="Expand image"
            >
              <ArrowsPointingOutIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); deleteImage(img.url) }}
              className="p-1 rounded-lg bg-error-container/80 text-error hover:bg-error hover:text-on-error transition-colors"
              aria-label="Delete image"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Position badge */}
        <span className="absolute top-1.5 left-1.5 text-xs bg-background/70 text-on-surface-variant rounded-lg px-1.5 py-0.5 pointer-events-none">
          {i === 0 ? 'Cover' : i + 1}
        </span>
      </div>

      {/* Description input */}
      <input
        type="text"
        value={img.description ?? ''}
        onChange={(e) => {
          const next = images.map((item, idx) =>
            idx === i ? { ...item, description: e.target.value } : item
          )
          onChange(next)
        }}
        placeholder="Caption…"
        maxLength={120}
        className="w-full text-xs px-2 py-1 rounded-lg bg-surface-highest/40 border border-outline-variant/20 text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:ring-1 focus:ring-secondary/50"
      />
    </div>
  ))}
</div>
```

- [ ] **Step 7: Update lightbox to show description**

In the lightbox `<img>` container, add a caption below the image using the current index:

```tsx
// Inside the lightbox image container div, after the <img>:
{images[lightboxIndex]?.description && (
  <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-sm text-white/80 bg-black/50 px-3 py-1.5 rounded-full text-center max-w-sm">
    {images[lightboxIndex].description}
  </p>
)}
// Remove or update the existing position counter span (keep it but move it or adjust)
```

Replace the existing bottom counter span:
```tsx
// Before:
<span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/60 bg-black/40 px-2.5 py-1 rounded-full">
  {lightboxIndex + 1} / {images.length}
</span>

// After:
<div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
  {images[lightboxIndex]?.description && (
    <p className="text-sm text-white/90 bg-black/60 px-3 py-1.5 rounded-full text-center max-w-sm">
      {images[lightboxIndex].description}
    </p>
  )}
  <span className="text-xs text-white/60 bg-black/40 px-2.5 py-1 rounded-full">
    {lightboxIndex + 1} / {images.length}
  </span>
</div>
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "ImageUploader" | head -10
```

- [ ] **Step 9: Commit**

```bash
git add components/admin/ImageUploader.tsx
git commit -m "feat: update ImageUploader to PropertyImage[] with per-image description inputs"
```

---

### Task 4: Update `PropertyForm` to use `PropertyImage[]`

**Files:**
- Modify: `components/admin/PropertyForm.tsx`

- [ ] **Step 1: Update images state type**

```ts
// Before:
const [images, setImages] = useState<string[]>(property?.images ?? [])

// After:
const [images, setImages] = useState<PropertyImage[]>(property?.images ?? [])
```

Add the import at the top:
```ts
import type { Property, PropertyImage, StripeAccount, CancellationPolicy } from '@/types'
```

- [ ] **Step 2: Update completeness check**

The check `images.length >= 3` still works since `PropertyImage[]` has a `.length`. No change needed.

- [ ] **Step 3: Verify payload serialization**

The `handleSubmit` payload already sends `images` directly — Supabase/JSON serialization handles `PropertyImage[]` as an array of objects. Confirm the PATCH allowlist in `app/api/admin/properties/route.ts` includes `'images'` (it already does based on earlier inspection). No change needed.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "PropertyForm\|images" | grep -v "test\|__tests__" | head -20
```

Fix any remaining type errors.

- [ ] **Step 5: Commit**

```bash
git add components/admin/PropertyForm.tsx
git commit -m "feat: update PropertyForm images state to PropertyImage[]"
```

---

### Task 5: Update public `ImageGallery` to show descriptions

**Files:**
- Modify: `components/public/ImageGallery.tsx`

The room page passes `room.images` (still `string[]` from the `rooms` table) plus `room.property.images` (now `PropertyImage[]`). We need to build a URL→description lookup. To keep `ImageGallery` simple, we add an optional `descriptions` prop that maps URL → description string.

- [ ] **Step 1: Update `ImageGallery` props**

```ts
// Before:
interface Props {
  images: string[]
  roomName: string
}

// After:
interface Props {
  images: string[]
  roomName: string
  descriptions?: Record<string, string>  // url → caption
}
```

- [ ] **Step 2: Destructure the new prop**

```ts
export default function ImageGallery({ images, roomName, descriptions = {} }: Props) {
```

- [ ] **Step 3: Add caption in lightbox**

In the lightbox, after the `<Image>` component inside the centered container div, replace the existing counter span with a captioned version:

```tsx
// Before (bottom of the lightbox):
<span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-on-surface-variant" aria-live="polite">
  {activeIndex + 1} / {images.length}
</span>

// After:
<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" aria-live="polite">
  {descriptions[images[activeIndex]] && (
    <p className="text-sm text-white/90 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full text-center max-w-sm">
      {descriptions[images[activeIndex]]}
    </p>
  )}
  <span className="text-sm text-on-surface-variant">
    {activeIndex + 1} / {images.length}
  </span>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add components/public/ImageGallery.tsx
git commit -m "feat: add optional descriptions prop to ImageGallery, show caption in lightbox"
```

---

### Task 6: Wire descriptions into the room booking page

**Files:**
- Modify: `app/(public)/rooms/[slug]/page.tsx`

The main page query already does `.select('*, property:properties(*)')` which now returns `property.images` as `PropertyImage[]`. We build a URL→description map and pass it to `ImageGallery`.

- [ ] **Step 1: Build description map after fetching room data**

After the `if (!rawRoom) notFound()` check, add:

```ts
import type { PropertyImage } from '@/types'

// Build URL → description map from property image library
const propertyImages = (rawRoom.property?.images ?? []) as PropertyImage[]
const imageDescriptions: Record<string, string> = {}
for (const img of propertyImages) {
  if (img.description) imageDescriptions[img.url] = img.description
}
```

- [ ] **Step 2: Pass `descriptions` to `ImageGallery`**

Find the `<ImageGallery>` usage in the JSX:

```tsx
// Before:
<ImageGallery images={room.images ?? []} roomName={room.name} />

// After:
<ImageGallery images={room.images ?? []} roomName={room.name} descriptions={imageDescriptions} />
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -v "test\|__tests__" | head -20
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/(public)/rooms/[slug]/page.tsx
git commit -m "feat: pass property image descriptions to room booking gallery"
```

---

### Task 7: Manual smoke test

- [ ] **Step 1: Open property edit in admin**

Navigate to `http://localhost:3000/admin/properties` → edit any property → Images tab.

Verify: each uploaded photo shows a "Caption…" input below it.

- [ ] **Step 2: Add a description to at least one photo**

Type a caption (e.g. "Living room with natural light") and click Save.

Verify: no console errors, save succeeds, caption persists on page reload.

- [ ] **Step 3: Check the room booking page**

Navigate to any room under that property at `http://localhost:3000/rooms/<slug>`.

Verify: clicking a photo in the gallery opens the lightbox. If that photo had a caption, it appears below the image. Photos without captions show no caption text (only the counter).

- [ ] **Step 4: Verify existing photos without descriptions are unaffected**

Open the lightbox on a photo that has no caption set. Verify only the page counter appears, no empty caption area.

- [ ] **Step 5: Final commit if any test fixes were needed**

```bash
git add -A
git commit -m "fix: address any smoke test issues with image descriptions"
```
