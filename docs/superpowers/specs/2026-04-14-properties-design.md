# Properties Feature Design

**Date:** 2026-04-14  
**Status:** Approved  
**Scope:** Admin-only property management with image library shared down to rooms

---

## Overview

Add the ability for admins to define **Properties** — physical buildings or locations — that rooms are associated with. Properties store address, overall bedroom/bathroom counts, a shared image library, and amenities. Rooms select a subset of their parent property's images. Properties are never exposed publicly; they are an admin-side organizational concept only.

---

## Database Schema

### Migration: alter `properties` table

Add four columns to the existing `properties` table:

| Column | Type | Default | Notes |
|---|---|---|---|
| `images` | `text[]` | `'{}'` | Full photo library for the property |
| `amenities` | `text[]` | `'{}'` | Shared amenities (pool, parking, gym, etc.) |
| `bedrooms` | `integer` | `0` | Total bedrooms across the whole property |
| `bathrooms` | `numeric` | `0` | Total bathrooms across the whole property |

**`rooms` table is unchanged.** Rooms keep their own `bedrooms`, `bathrooms`, and `images` columns. `rooms.images` values are a curated subset of `properties.images` URLs chosen by the admin.

---

## TypeScript Types

Update `Property` in `types/index.ts`:

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

No changes to the `Room` interface.

---

## Admin CRUD Pages

### New routes

```
app/admin/(protected)/properties/
  page.tsx           — list all properties with room count; "Add Property" button
  new/page.tsx       — create form
  [id]/edit/page.tsx — edit form with pre-filled values
```

### `PropertyForm` component

New `components/admin/PropertyForm.tsx` with these sections (mirrors `RoomForm` structure):

1. **Basic Info** — name, address, city, state, description
2. **Property Details** — bedrooms (integer), bathrooms (numeric, step 0.5)
3. **Amenities** — reuses existing `AmenitiesTagInput`
4. **Images** — reuses existing `ImageUploader` (upload path: `property-images/{property-id}/`)

### API route

New `app/api/admin/properties/route.ts`:
- `POST` — create property
- `PATCH` — update property (id in body)
- `DELETE` — delete property (id in body); blocked if the property has associated rooms

Uses the service-role client, same pattern as existing admin routes.

### Admin sidebar

Add **"Properties"** nav item between "Rooms" and "Bookings" using `BuildingOfficeIcon` from Heroicons, pointing to `/admin/properties`.

---

## Room Form Changes

### Property field becomes immutable after creation

- **New room:** Property selector dropdown (required, must choose before saving)
- **Existing room:** Property name shown as static read-only text — no dropdown. To move a room to a different property, the admin must delete the room and recreate it under the new property.

### Image section replaced with `PropertyImagePicker`

New `components/admin/PropertyImagePicker.tsx`:
- Displays the parent property's `images` array as a thumbnail grid
- Each thumbnail has a checkbox; checked = included in `rooms.images`
- Selected URLs are stored into `rooms.images` exactly as before
- If the property has no images yet, shows an empty state: *"Upload images to the property first, then return here to select room images."*

---

## Data Flow

### Create property
Admin fills form → `POST /api/admin/properties` → insert row → redirect to `/admin/properties`

### Edit property
Admin edits form → `PATCH /api/admin/properties` → update all columns including `images[]` and `amenities[]`

### Delete property
- Blocked when the property has associated rooms (button disabled, tooltip explains why)
- Admin must delete or reassign all rooms first
- No cascade delete, no automatic storage cleanup

### Room image selection
1. Admin opens room edit form
2. `PropertyImagePicker` loads the (immutable) parent property's `images` array
3. Admin checks/unchecks images
4. On save, selected URLs written to `rooms.images`

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Property has no images | Picker shows empty state; room images stay as-is until property gets images |
| Admin tries to delete property with rooms | Delete button disabled; tooltip: "Remove all rooms from this property first" |
| Admin tries to change room's property | Not possible — property field is read-only on existing rooms |
| Image uploaded to wrong property | Admin must delete it from the property and re-upload under the correct one |

---

## Out of Scope

- Public-facing property detail pages (`/properties/[slug]`)
- Automatic cleanup of Supabase storage on property delete
- Moving rooms between properties via the UI
