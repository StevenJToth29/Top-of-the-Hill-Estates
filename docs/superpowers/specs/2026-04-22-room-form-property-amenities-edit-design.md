# Design: Inline Property Amenities Editing from Room Form

**Date:** 2026-04-22
**Status:** Approved

## Overview

Allow admins to edit, delete, and save property-level amenities directly from the room edit form, without navigating away to the property page. Changes affect the property and all its associated units.

## Goals

- Edit and delete property amenities inline on the Room Form's Amenities tab
- Explicit "Save Property Amenities" button — separate from the room's own save
- No full-page navigation required
- No regression to the existing property form or room form behavior

## Architecture

No new files or routes are introduced. Changes are confined to:

1. `app/api/admin/properties/route.ts` — PATCH handler updated to support partial updates
2. `components/admin/RoomForm.tsx` — Amenities tab updated with editable property amenities

## 1. API: Partial PATCH for Properties

**File:** `app/api/admin/properties/route.ts`

The existing `PATCH` handler currently expects and writes the full property payload. It will be updated to support partial updates — only fields explicitly present in the request body are written to the database.

**Logic:**
- Destructure `id` from the body; treat all remaining keys as the update set
- Build the Supabase update object from only the keys present in the body
- Fields absent from the body are not included in the update, leaving DB columns untouched
- Care must be taken for fields that are legitimately falsy (`0`, `false`, `null`, `""`) — these must still be written if present; the filter should check `key in body`, not truthiness

**Callers:**
- `PropertyForm` continues sending the full payload — behavior unchanged
- `RoomForm` will send only `{ id, amenities: string[] }` for the property amenities save

## 2. RoomForm: Mutable Property Amenities State

**File:** `components/admin/RoomForm.tsx`

### New state

```ts
const [propertyAmenities, setPropertyAmenities] = useState<string[]>(
  selectedProperty?.amenities ?? []
)
const [propertyAmenitiesSaving, setPropertyAmenitiesSaving] = useState(false)
const [propertyAmenitiesSaved, setPropertyAmenitiesSaved] = useState(false)
const [propertyAmenitiesError, setPropertyAmenitiesError] = useState<string | null>(null)
// baseline to detect dirty state
const [propertyAmenitiesBaseline, setPropertyAmenitiesBaseline] = useState<string[]>(
  selectedProperty?.amenities ?? []
)
```

The existing `const propertyAmenities = selectedProperty?.amenities ?? []` derivation on line 145 is removed and replaced by the state above.

### Dirty state detection

```ts
const propertyAmenitiesDirty =
  JSON.stringify(propertyAmenities) !== JSON.stringify(propertyAmenitiesBaseline)
```

### Save handler

```ts
async function handleSavePropertyAmenities() {
  setPropertyAmenitiesSaving(true)
  setPropertyAmenitiesError(null)
  try {
    const res = await fetch('/api/admin/properties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: propertyId, amenities: propertyAmenities }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Save failed')
    setPropertyAmenitiesBaseline(propertyAmenities)
    setPropertyAmenitiesSaved(true)
    setTimeout(() => setPropertyAmenitiesSaved(false), 3000)
  } catch (err) {
    setPropertyAmenitiesError(err instanceof Error ? err.message : 'Save failed')
  } finally {
    setPropertyAmenitiesSaving(false)
  }
}
```

## 3. RoomForm: Amenities Tab UI

### "Inherited from Property" card — redesigned

**Before:** Static read-only chip list with a note "To change these, edit the property's amenities."

**After:**
- Card subtitle: *"Changes here affect [Property Name] and all its units"*
- Body: `<AmenitiesTagInput value={propertyAmenities} onChange={setPropertyAmenities} context="property" />`
- Footer row inside the card:
  - "Save Property Amenities" button — enabled only when `propertyAmenitiesDirty`, shows spinner while saving, styled consistently with other save actions (gradient primary button, smaller variant)
  - "Saved ✓" flash in secondary color when `propertyAmenitiesSaved`
  - Inline error text in error color when `propertyAmenitiesError` is set

The "Unit-Specific Amenities" and "What Guests See" cards are unchanged.

### Tab badge

The existing tab badge already counts `amenities.length + propertyAmenities.length`. Since `propertyAmenities` is now state (not a derived const), this continues to work correctly with no change.

## Error Handling

- Network/API errors surface inline within the card — no full-page disruption
- The room's own save is unaffected by property amenities save state
- If the user navigates away with unsaved property amenities, no confirmation is shown (out of scope; admin form, low stakes)

## Testing Checklist

- [ ] Add a property amenity from the room form → Save Property Amenities → reload page → amenity persists on property
- [ ] Delete a property amenity from the room form → save → verify removed from property and from other rooms in same property
- [ ] "Save Property Amenities" button is disabled when no changes have been made
- [ ] "Save Property Amenities" button activates after any add or remove
- [ ] Dirty state resets after a successful save (button disables again)
- [ ] "Saved ✓" flash appears and disappears after 3 seconds
- [ ] Error state renders inline on API failure
- [ ] Room's "Save Changes" behavior is unchanged
- [ ] PropertyForm PATCH continues to work (full payload still accepted by partial update handler)
- [ ] Partial PATCH with only `amenities` does not overwrite other property fields
