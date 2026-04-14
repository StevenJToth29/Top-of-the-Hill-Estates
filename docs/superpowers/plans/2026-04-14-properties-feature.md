# Properties Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin-only property management — admins create/edit/delete properties that hold a shared image library, amenities, and overall bedroom/bathroom counts, and rooms select a subset of their property's images.

**Architecture:** Properties are stored in the existing `properties` table (4 new columns via migration). A new `PropertyForm` mirrors the existing `RoomForm` pattern. A new `PropertyImagePicker` replaces `ImageUploader` in `RoomForm` — rooms pick from their property's image library rather than uploading independently. `ImageUploader` is generalized to accept any Supabase bucket, then reused in `PropertyForm`. Property assignment on rooms becomes immutable (read-only on edit).

**Tech Stack:** Next.js 14 App Router, Server Actions, Supabase (postgres + storage), Tailwind CSS, TypeScript, Heroicons

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Migrate | Supabase SQL | Add `images`, `amenities`, `bedrooms`, `bathrooms` to `properties` |
| Modify | `types/index.ts` | Add 4 fields to `Property` interface |
| Modify | `components/admin/ImageUploader.tsx` | Replace `roomId` prop with `bucket` + `uploadFolder` |
| Create | `components/admin/PropertyImagePicker.tsx` | Checkbox grid for selecting room images from property library |
| Create | `app/api/admin/properties/route.ts` | POST, PATCH, DELETE for properties |
| Create | `components/admin/PropertyForm.tsx` | Admin form: basic info, details, amenities, images |
| Create | `app/admin/(protected)/properties/page.tsx` | List all properties with room count + delete |
| Create | `app/admin/(protected)/properties/new/page.tsx` | Create property (server action) |
| Create | `app/admin/(protected)/properties/[id]/edit/page.tsx` | Edit property (server action) |
| Create | `components/admin/DeletePropertyButton.tsx` | Client component — calls DELETE API, shows disabled state |
| Modify | `components/admin/AdminSidebar.tsx` | Add Properties nav item |
| Modify | `components/admin/RoomForm.tsx` | Lock property field on edit; swap ImageUploader for PropertyImagePicker |
| Modify | `app/admin/(protected)/rooms/[id]/edit/page.tsx` | Remove `property_id` from updateRoom server action |

---

## Task 1: Apply DB Migration

**Files:**
- Supabase SQL (via MCP tool or Supabase dashboard SQL editor)

- [ ] **Step 1: Run the migration SQL**

In the Supabase dashboard SQL editor (or via MCP `apply_migration`), run:

```sql
ALTER TABLE public.properties
  ADD COLUMN images    text[]   NOT NULL DEFAULT '{}',
  ADD COLUMN amenities text[]   NOT NULL DEFAULT '{}',
  ADD COLUMN bedrooms  integer  NOT NULL DEFAULT 0,
  ADD COLUMN bathrooms numeric  NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Create the property-images storage bucket**

In Supabase dashboard → Storage → New bucket:
- Name: `property-images`
- Public: ✓ (checked)

Or via SQL:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 3: Add storage policy for property-images bucket**

```sql
CREATE POLICY "Public read property-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images');

CREATE POLICY "Auth upload property-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-images' AND auth.role() = 'authenticated');

CREATE POLICY "Auth delete property-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'property-images' AND auth.role() = 'authenticated');
```

- [ ] **Step 4: Verify columns exist**

Run in SQL editor:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'properties'
ORDER BY ordinal_position;
```

Expected: rows for `images`, `amenities`, `bedrooms`, `bathrooms` appear.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: note DB migration applied for properties feature"
```

(No SQL files to commit — migration was applied directly. This commit just marks the milestone.)

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Update the Property interface**

In `types/index.ts`, replace the current `Property` interface:

```ts
export interface Property {
  id: string
  name: string
  address: string
  city: string
  state: string
  description: string
  created_at: string
}
```

With:

```ts
export interface Property {
  id: string
  name: string
  address: string
  city: string
  state: string
  description: string
  images: string[]
  amenities: string[]
  bedrooms: number
  bathrooms: number
  created_at: string
}
```

- [ ] **Step 2: Run type check**

```bash
cd /workspaces/Top-of-the-Hill-Estates && npx tsc --noEmit
```

Expected: 0 errors. (The new fields are optional in existing consumers since Supabase `select('*')` will now return them.)

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add images, amenities, bedrooms, bathrooms to Property type"
```

---

## Task 3: Generalize ImageUploader

**Files:**
- Modify: `components/admin/ImageUploader.tsx`

`ImageUploader` currently hardcodes the `room-images` bucket and uses a `roomId` prop. We generalize it to accept any bucket and upload folder so `PropertyForm` can reuse it.

- [ ] **Step 1: Update the props interface and component signature**

Replace the top of `components/admin/ImageUploader.tsx` — change the interface and function signature from:

```tsx
interface ImageUploaderProps {
  images: string[]
  roomId: string
  onChange: (images: string[]) => void
}

export default function ImageUploader({ images, roomId, onChange }: ImageUploaderProps) {
```

To:

```tsx
interface ImageUploaderProps {
  images: string[]
  bucket: string
  uploadFolder: string
  onChange: (images: string[]) => void
}

export default function ImageUploader({ images, bucket, uploadFolder, onChange }: ImageUploaderProps) {
```

- [ ] **Step 2: Update the uploadFiles function**

Replace the upload path and bucket references inside `uploadFiles`:

```tsx
// Old
const path = `${roomId}/${Date.now()}-${file.name}`
const { data, error: uploadError } = await supabase.storage
  .from('room-images')
  .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })

if (uploadError) throw uploadError

const {
  data: { publicUrl },
} = supabase.storage.from('room-images').getPublicUrl(data.path)
```

```tsx
// New
const path = `${uploadFolder}/${Date.now()}-${file.name}`
const { data, error: uploadError } = await supabase.storage
  .from(bucket)
  .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })

if (uploadError) throw uploadError

const {
  data: { publicUrl },
} = supabase.storage.from(bucket).getPublicUrl(data.path)
```

- [ ] **Step 3: Update the deleteImage function**

Replace the delete logic:

```tsx
// Old
async function deleteImage(url: string) {
  const supabase = createClient()
  const match = url.match(/room-images\/(.+)$/)
  if (match) {
    await supabase.storage.from('room-images').remove([match[1]])
  }
  onChange(images.filter((img) => img !== url))
}
```

```tsx
// New
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
```

- [ ] **Step 4: Update RoomForm to pass new props**

In `components/admin/RoomForm.tsx`, find the `<ImageUploader>` usage and update it:

```tsx
// Old
<ImageUploader
  images={images}
  roomId={roomId ?? 'new'}
  onChange={setImages}
/>
```

```tsx
// New
<ImageUploader
  images={images}
  bucket="room-images"
  uploadFolder={roomId ?? 'new'}
  onChange={setImages}
/>
```

- [ ] **Step 5: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/admin/ImageUploader.tsx components/admin/RoomForm.tsx
git commit -m "refactor: generalize ImageUploader to accept any bucket and uploadFolder"
```

---

## Task 4: Create PropertyImagePicker Component

**Files:**
- Create: `components/admin/PropertyImagePicker.tsx`

Replaces `ImageUploader` in `RoomForm`. Shows the parent property's images as a checkbox grid — checked images are included in `rooms.images`.

- [ ] **Step 1: Create the file**

Create `components/admin/PropertyImagePicker.tsx`:

```tsx
'use client'

import NextImage from 'next/image'
import { CheckIcon } from '@heroicons/react/24/solid'
import { PhotoIcon } from '@heroicons/react/24/outline'

interface PropertyImagePickerProps {
  propertyImages: string[]
  selectedImages: string[]
  onChange: (images: string[]) => void
}

export default function PropertyImagePicker({
  propertyImages,
  selectedImages,
  onChange,
}: PropertyImagePickerProps) {
  if (propertyImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-secondary/30 bg-surface-highest/20 p-8 text-center">
        <PhotoIcon className="w-8 h-8 text-on-surface-variant/40" />
        <p className="text-sm text-on-surface-variant/70">
          No images have been uploaded to this property yet.
        </p>
        <p className="text-xs text-on-surface-variant/50">
          Add images to the property first, then return here to select room images.
        </p>
      </div>
    )
  }

  function toggle(url: string) {
    if (selectedImages.includes(url)) {
      onChange(selectedImages.filter((u) => u !== url))
    } else {
      onChange([...selectedImages, url])
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-on-surface-variant/60">
        {selectedImages.length} of {propertyImages.length} images selected
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {propertyImages.map((url, i) => {
          const isSelected = selectedImages.includes(url)
          return (
            <button
              key={url}
              type="button"
              onClick={() => toggle(url)}
              className={[
                'relative rounded-xl overflow-hidden aspect-video transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isSelected
                  ? 'ring-2 ring-secondary'
                  : 'ring-1 ring-surface-high opacity-70 hover:opacity-100',
              ].join(' ')}
              aria-label={`${isSelected ? 'Deselect' : 'Select'} image ${i + 1}`}
            >
              <NextImage src={url} alt={`Property image ${i + 1}`} fill className="object-cover" />
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 rounded-full bg-secondary p-0.5">
                  <CheckIcon className="w-3.5 h-3.5 text-background" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/PropertyImagePicker.tsx
git commit -m "feat: add PropertyImagePicker component for selecting room images from property library"
```

---

## Task 5: Create Properties API Route

**Files:**
- Create: `app/api/admin/properties/route.ts`

Handles create (`POST`), update (`PATCH`), and delete (`DELETE`) for properties. Delete is blocked when the property has associated rooms.

- [ ] **Step 1: Create the file**

Create `app/api/admin/properties/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('properties')
      .insert({
        name: body.name,
        address: body.address,
        city: body.city,
        state: body.state,
        description: body.description ?? '',
        bedrooms: Number(body.bedrooms ?? 0),
        bathrooms: Number(body.bathrooms ?? 0),
        amenities: body.amenities ?? [],
        images: body.images ?? [],
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...fields } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = createServiceRoleClient()
    const { data, error } = await supabase
      .from('properties')
      .update({
        name: fields.name,
        address: fields.address,
        city: fields.city,
        state: fields.state,
        description: fields.description ?? '',
        bedrooms: Number(fields.bedrooms ?? 0),
        bathrooms: Number(fields.bathrooms ?? 0),
        amenities: fields.amenities ?? [],
        images: fields.images ?? [],
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const supabase = createServiceRoleClient()

    // Guard: block delete if rooms exist
    const { count } = await supabase
      .from('rooms')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Remove all rooms from this property before deleting it.' },
        { status: 409 },
      )
    }

    const { error } = await supabase.from('properties').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/properties/route.ts
git commit -m "feat: add /api/admin/properties route (POST, PATCH, DELETE)"
```

---

## Task 6: Create PropertyForm Component

**Files:**
- Create: `components/admin/PropertyForm.tsx`

Client component — mirrors `RoomForm`'s structure. Sections: Basic Info, Property Details, Amenities, Images.

- [ ] **Step 1: Create the file**

Create `components/admin/PropertyForm.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import type { Property } from '@/types'
import AmenitiesTagInput from './AmenitiesTagInput'
import ImageUploader from './ImageUploader'

interface PropertyFormProps {
  property?: Property
  propertyId?: string
  onSave: (formData: FormData) => Promise<void>
}

export default function PropertyForm({ property, propertyId, onSave }: PropertyFormProps) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(property?.name ?? '')
  const [address, setAddress] = useState(property?.address ?? '')
  const [city, setCity] = useState(property?.city ?? '')
  const [state, setState] = useState(property?.state ?? '')
  const [description, setDescription] = useState(property?.description ?? '')
  const [bedrooms, setBedrooms] = useState(property?.bedrooms ?? 0)
  const [bathrooms, setBathrooms] = useState(property?.bathrooms ?? 0)
  const [amenities, setAmenities] = useState<string[]>(property?.amenities ?? [])
  const [images, setImages] = useState<string[]>(property?.images ?? [])
  const [error, setError] = useState<string | null>(null)

  const inputClass =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50'
  const labelClass = 'block text-sm font-medium text-on-surface-variant mb-1.5'

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData()
    fd.set('name', name)
    fd.set('address', address)
    fd.set('city', city)
    fd.set('state', state)
    fd.set('description', description)
    fd.set('bedrooms', String(bedrooms))
    fd.set('bathrooms', String(bathrooms))
    fd.set('amenities', JSON.stringify(amenities))
    fd.set('images', JSON.stringify(images))
    if (propertyId) fd.set('id', propertyId)

    startTransition(async () => {
      try {
        await onSave(fd)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-5">
        <h2 className="font-display text-lg font-semibold text-on-surface">Basic Information</h2>

        <div>
          <label className={labelClass}>Property Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Hill House"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Street Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            placeholder="123 Main St"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              placeholder="Phoenix"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              required
              placeholder="AZ"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Brief description of the property"
            className={inputClass}
          />
        </div>
      </section>

      {/* Property Details */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-5">
        <h2 className="font-display text-lg font-semibold text-on-surface">Property Details</h2>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Total Bedrooms</label>
            <input
              type="number"
              value={bedrooms}
              onChange={(e) => setBedrooms(Number(e.target.value))}
              min={0}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Total Bathrooms</label>
            <input
              type="number"
              value={bathrooms}
              onChange={(e) => setBathrooms(Number(e.target.value))}
              min={0}
              step={0.5}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-on-surface">Amenities</h2>
        <AmenitiesTagInput value={amenities} onChange={setAmenities} />
      </section>

      {/* Images */}
      <section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold text-on-surface">Property Images</h2>
        <p className="text-xs text-on-surface-variant/60">
          Upload the full image library for this property. Rooms will select from these images.
        </p>
        <ImageUploader
          images={images}
          bucket="property-images"
          uploadFolder={propertyId ?? 'new'}
          onChange={setImages}
        />
      </section>

      {error && (
        <p className="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-8 py-3 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : property ? 'Save Changes' : 'Create Property'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/PropertyForm.tsx
git commit -m "feat: add PropertyForm component"
```

---

## Task 7: Create DeletePropertyButton Component

**Files:**
- Create: `components/admin/DeletePropertyButton.tsx`

Client component used on the properties list page. Calls DELETE /api/admin/properties. Disabled when the property has rooms.

- [ ] **Step 1: Create the file**

Create `components/admin/DeletePropertyButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'

interface DeletePropertyButtonProps {
  propertyId: string
  hasRooms: boolean
}

export default function DeletePropertyButton({ propertyId, hasRooms }: DeletePropertyButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Delete this property? This cannot be undone.')) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/properties', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: propertyId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Delete failed')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setLoading(false)
    }
  }

  if (hasRooms) {
    return (
      <span
        title="Remove all rooms from this property before deleting it."
        className="flex items-center gap-1.5 text-sm text-on-surface-variant/40 cursor-not-allowed select-none"
      >
        <TrashIcon className="w-4 h-4" />
        Delete
      </span>
    )
  }

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm text-error hover:text-error/80 transition-colors disabled:opacity-50"
      >
        <TrashIcon className="w-4 h-4" />
        {loading ? 'Deleting…' : 'Delete'}
      </button>
      {error && (
        <p className="text-xs text-error mt-1">{error}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add components/admin/DeletePropertyButton.tsx
git commit -m "feat: add DeletePropertyButton component"
```

---

## Task 8: Create Admin Properties List Page

**Files:**
- Create: `app/admin/(protected)/properties/page.tsx`

Server component. Lists all properties with room count per property. Links to new/edit. Includes `DeletePropertyButton`.

- [ ] **Step 1: Create the file**

Create `app/admin/(protected)/properties/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline'
import { createServiceRoleClient } from '@/lib/supabase'
import type { Property } from '@/types'
import DeletePropertyButton from '@/components/admin/DeletePropertyButton'

export default async function AdminPropertiesPage() {
  const supabase = createServiceRoleClient()

  const [{ data: properties }, { data: rooms }] = await Promise.all([
    supabase.from('properties').select('*').order('name'),
    supabase.from('rooms').select('property_id'),
  ])

  const typedProperties = (properties ?? []) as Property[]

  const roomCountByProperty = (rooms ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.property_id] = (acc[r.property_id] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold text-on-surface">Properties</h1>
            <p className="text-on-surface-variant mt-1">{typedProperties.length} properties</p>
          </div>
          <Link
            href="/admin/properties/new"
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-5 py-2.5 hover:opacity-90 transition-opacity"
          >
            <PlusIcon className="w-4 h-4" />
            Add Property
          </Link>
        </div>

        {/* List */}
        {typedProperties.length === 0 ? (
          <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-12 text-center">
            <p className="text-on-surface-variant">No properties yet.</p>
            <Link href="/admin/properties/new" className="mt-4 inline-block text-secondary hover:underline text-sm">
              Add your first property
            </Link>
          </div>
        ) : (
          <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl overflow-hidden divide-y divide-outline-variant">
            {typedProperties.map((property) => {
              const roomCount = roomCountByProperty[property.id] ?? 0
              return (
                <div key={property.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-on-surface">{property.name}</p>
                    <p className="text-sm text-on-surface-variant/60 mt-0.5">
                      {property.address}, {property.city}, {property.state}
                    </p>
                    <p className="text-xs text-on-surface-variant/50 mt-0.5">
                      {property.bedrooms}bd / {property.bathrooms}ba · {roomCount} room{roomCount !== 1 ? 's' : ''} · {property.images.length} image{property.images.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <Link
                      href={`/admin/properties/${property.id}/edit`}
                      className="flex items-center gap-1.5 text-sm bg-surface-container rounded-xl px-3 py-1.5 text-on-surface-variant hover:bg-surface-high transition-colors"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                      Edit
                    </Link>
                    <DeletePropertyButton
                      propertyId={property.id}
                      hasRooms={roomCount > 0}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/\(protected\)/properties/page.tsx
git commit -m "feat: add admin properties list page"
```

---

## Task 9: Create Admin Properties New Page

**Files:**
- Create: `app/admin/(protected)/properties/new/page.tsx`

Server component with inline server action. POSTs to the API and redirects to edit page (so images can be uploaded against the real ID).

- [ ] **Step 1: Create the file**

Create `app/admin/(protected)/properties/new/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { createServerSupabaseClient } from '@/lib/supabase'
import PropertyForm from '@/components/admin/PropertyForm'

export default async function NewPropertyPage() {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  async function createProperty(formData: FormData) {
    'use server'
    const authClient = await createServerSupabaseClient()
    const { data: { user: actionUser } } = await authClient.auth.getUser()
    if (!actionUser) redirect('/admin/login')

    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name'),
        address: formData.get('address'),
        city: formData.get('city'),
        state: formData.get('state'),
        description: formData.get('description'),
        bedrooms: formData.get('bedrooms'),
        bathrooms: formData.get('bathrooms'),
        amenities: JSON.parse((formData.get('amenities') as string) || '[]'),
        images: JSON.parse((formData.get('images') as string) || '[]'),
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to create property')
    }

    const data = await res.json()
    redirect(`/admin/properties/${data.id}/edit`)
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/properties"
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Properties
          </Link>
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">Add New Property</h1>
          <p className="text-on-surface-variant mt-1">Fill in the details below to create a new property.</p>
        </div>

        <PropertyForm onSave={createProperty} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/\(protected\)/properties/new/page.tsx
git commit -m "feat: add admin new property page"
```

---

## Task 10: Create Admin Properties Edit Page

**Files:**
- Create: `app/admin/(protected)/properties/[id]/edit/page.tsx`

Server component with inline server action. Fetches existing property, renders `PropertyForm` with pre-filled values.

- [ ] **Step 1: Create the file**

Create `app/admin/(protected)/properties/[id]/edit/page.tsx`:

```tsx
export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { createServiceRoleClient, createServerSupabaseClient } from '@/lib/supabase'
import PropertyForm from '@/components/admin/PropertyForm'
import type { Property } from '@/types'

interface EditPropertyPageProps {
  params: { id: string }
}

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const serverClient = await createServerSupabaseClient()
  const { data: { user } } = await serverClient.auth.getUser()
  if (!user) redirect('/admin/login')

  const supabase = createServiceRoleClient()
  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!property) notFound()

  async function updateProperty(formData: FormData) {
    'use server'
    const authClient = await createServerSupabaseClient()
    const { data: { user: actionUser } } = await authClient.auth.getUser()
    if (!actionUser) redirect('/admin/login')

    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/admin/properties`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: formData.get('id'),
        name: formData.get('name'),
        address: formData.get('address'),
        city: formData.get('city'),
        state: formData.get('state'),
        description: formData.get('description'),
        bedrooms: formData.get('bedrooms'),
        bathrooms: formData.get('bathrooms'),
        amenities: JSON.parse((formData.get('amenities') as string) || '[]'),
        images: JSON.parse((formData.get('images') as string) || '[]'),
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Failed to update property')
    }

    redirect('/admin/properties')
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/properties"
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Properties
          </Link>
        </div>

        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">Edit Property</h1>
          <p className="text-on-surface-variant mt-1">{property.name}</p>
        </div>

        <PropertyForm
          property={property as Property}
          propertyId={params.id}
          onSave={updateProperty}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "app/admin/(protected)/properties/[id]/edit/page.tsx"
git commit -m "feat: add admin edit property page"
```

---

## Task 11: Add Properties to Admin Sidebar

**Files:**
- Modify: `components/admin/AdminSidebar.tsx`

- [ ] **Step 1: Import BuildingOfficeIcon**

In `components/admin/AdminSidebar.tsx`, add `BuildingOfficeIcon` to the existing Heroicons import:

```tsx
// Before
import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  HomeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
```

```tsx
// After
import {
  ArrowPathIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  CalendarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  HomeIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
```

- [ ] **Step 2: Add Properties to NAV_ITEMS**

Replace the `NAV_ITEMS` array:

```tsx
// Before
export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: ChartBarIcon },
  { label: 'Rooms', href: '/admin/rooms', icon: HomeIcon },
  { label: 'Bookings', href: '/admin/bookings', icon: CalendarIcon },
  { label: 'Calendar', href: '/admin/calendar', icon: CalendarDaysIcon },
  { label: 'iCal Sync', href: '/admin/ical', icon: ArrowPathIcon },
  { label: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon },
]
```

```tsx
// After
export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: ChartBarIcon },
  { label: 'Properties', href: '/admin/properties', icon: BuildingOfficeIcon },
  { label: 'Rooms', href: '/admin/rooms', icon: HomeIcon },
  { label: 'Bookings', href: '/admin/bookings', icon: CalendarIcon },
  { label: 'Calendar', href: '/admin/calendar', icon: CalendarDaysIcon },
  { label: 'iCal Sync', href: '/admin/ical', icon: ArrowPathIcon },
  { label: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon },
]
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/admin/AdminSidebar.tsx
git commit -m "feat: add Properties nav item to admin sidebar"
```

---

## Task 12: Update RoomForm — Lock Property + Swap Image Picker

**Files:**
- Modify: `components/admin/RoomForm.tsx`
- Modify: `app/admin/(protected)/rooms/[id]/edit/page.tsx`

Two changes:
1. Property selector becomes read-only text when editing an existing room
2. `ImageUploader` is replaced with `PropertyImagePicker`

- [ ] **Step 1: Add PropertyImagePicker import to RoomForm**

In `components/admin/RoomForm.tsx`, replace:

```tsx
import AmenitiesTagInput from './AmenitiesTagInput'
import ImageUploader from './ImageUploader'
import ICalSourcesManager from './ICalSourcesManager'
```

With:

```tsx
import AmenitiesTagInput from './AmenitiesTagInput'
import ICalSourcesManager from './ICalSourcesManager'
import PropertyImagePicker from './PropertyImagePicker'
```

- [ ] **Step 2: Add propertyImages derived state**

In `RoomForm`, after the existing `useState` declarations (around line 44), add:

```tsx
const propertyImages =
  properties.find((p) => p.id === propertyId)?.images ?? []
```

- [ ] **Step 3: Replace the Property selector UI**

In the form JSX, find the property `<select>` block:

```tsx
<div>
  <label className={labelClass}>Property</label>
  <select
    value={propertyId}
    onChange={(e) => setPropertyId(e.target.value)}
    required
    className={inputClass}
  >
    {properties.map((p) => (
      <option key={p.id} value={p.id}>
        {p.name}
      </option>
    ))}
  </select>
</div>
```

Replace with:

```tsx
<div>
  <label className={labelClass}>Property</label>
  {room ? (
    <p className="px-4 py-3 rounded-xl bg-surface-highest/20 text-on-surface-variant text-sm">
      {properties.find((p) => p.id === propertyId)?.name ?? propertyId}
    </p>
  ) : (
    <select
      value={propertyId}
      onChange={(e) => setPropertyId(e.target.value)}
      required
      className={inputClass}
    >
      {properties.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )}
</div>
```

- [ ] **Step 4: Replace ImageUploader with PropertyImagePicker in the Images section**

Find the Images section in RoomForm:

```tsx
{/* Images */}
<section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-4">
  <h2 className="font-display text-lg font-semibold text-on-surface">Images</h2>
  <ImageUploader
    images={images}
    bucket="room-images"
    uploadFolder={roomId ?? 'new'}
    onChange={setImages}
  />
</section>
```

Replace with:

```tsx
{/* Images */}
<section className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-4">
  <h2 className="font-display text-lg font-semibold text-on-surface">Images</h2>
  <PropertyImagePicker
    propertyImages={propertyImages}
    selectedImages={images}
    onChange={setImages}
  />
</section>
```

- [ ] **Step 5: Remove property_id from the room edit server action**

In `app/admin/(protected)/rooms/[id]/edit/page.tsx`, inside `updateRoom`, remove the `property_id` line:

```tsx
// Remove this line:
property_id: formData.get('property_id') as string,
```

The property is immutable on edit — it should not be updated.

- [ ] **Step 6: Run type check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7: Manual verification**

1. Navigate to `/admin/properties` — list page loads, shows "Add Property" button
2. Click "Add Property" — form opens with all fields
3. Create a property, upload images — redirects to edit page with real ID
4. Navigate to `/admin/rooms/new` — property dropdown works, image picker shows property images
5. Navigate to `/admin/rooms/{id}/edit` — property shown as read-only text, image picker shows property's images as checkboxes

- [ ] **Step 8: Commit**

```bash
git add components/admin/RoomForm.tsx "app/admin/(protected)/rooms/[id]/edit/page.tsx"
git commit -m "feat: lock property field on room edit and replace ImageUploader with PropertyImagePicker"
```

---

## Self-Review

**Spec coverage:**
- ✓ DB migration: Task 1
- ✓ TypeScript types: Task 2
- ✓ ImageUploader generalized: Task 3
- ✓ PropertyImagePicker: Task 4
- ✓ API route (POST/PATCH/DELETE with room guard): Task 5
- ✓ PropertyForm (all 4 sections): Task 6
- ✓ DeletePropertyButton (disabled when rooms exist): Task 7
- ✓ Admin list page with room count: Task 8
- ✓ Admin new page: Task 9
- ✓ Admin edit page: Task 10
- ✓ Sidebar nav item: Task 11
- ✓ RoomForm — lock property + swap image picker: Task 12
- ✓ Remove property_id from room edit action: Task 12 Step 5

**Placeholder scan:** No TBDs, all steps have complete code. ✓

**Type consistency:** `Property` gains 4 fields in Task 2 and those same fields are used throughout Tasks 3–12. `PropertyImagePicker` props (`propertyImages`, `selectedImages`, `onChange`) match usage in Task 12. ✓
