# Google Places Address Autocomplete — Design Spec

**Date:** 2026-04-15
**Status:** Approved

---

## Overview

Add Google Places Autocomplete to the street address field in `PropertyForm`. When an admin types an address, suggestions appear in a Google-rendered dropdown. Selecting a suggestion auto-fills the `address`, `city`, and `state` fields. The input works as a plain text field if the Places library is unavailable.

---

## Scope

- Admin property creation (`/admin/properties/new`)
- Admin property editing (`/admin/properties/[id]/edit`)
- No database schema changes
- No changes to public-facing pages
- No new npm packages

---

## Architecture

### New component: `components/admin/PlacesAddressInput.tsx`

A `'use client'` component that wraps a styled address `<input>` with Google Places Autocomplete behavior.

**Props:**
```typescript
interface PlacesAddressInputProps {
  value: string
  onChange: (value: string) => void
  onCityChange: (city: string) => void
  onStateChange: (state: string) => void
  className?: string
  placeholder?: string
}
```

**Behavior:**
1. Renders a standard `<input type="text">` immediately — no loading gate.
2. On mount, loads the `places` library via `@googlemaps/js-api-loader` using `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
3. Attaches `new google.maps.places.Autocomplete(inputRef.current, options)` once the library resolves.
4. Autocomplete options:
   - `types: ['address']`
   - `componentRestrictions: { country: 'us' }`
   - `fields: ['address_components']` (minimal field mask — avoids billing for unused data)
5. On `place_changed`:
   - Parses `place.address_components` to extract:
     - `street_number` (long_name) + `route` (long_name) → joined as `"{number} {route}"` → calls `onChange`
     - `locality` (long_name), falling back to `sublocality` → calls `onCityChange`
     - `administrative_area_level_1` (short_name, e.g. `"AZ"`) → calls `onStateChange`
   - Any component not found in the result is skipped (existing field value preserved).
6. If `@googlemaps/js-api-loader` rejects (network error, bad API key), the component catches the error silently and the input continues as a plain text field.
7. On unmount, removes the `place_changed` listener to prevent memory leaks.

### Modified component: `components/admin/PropertyForm.tsx`

Replace the plain `<input>` for the `address` field with `<PlacesAddressInput>`, passing `onCityChange` and `onStateChange` callbacks that call `setCity` and `setState` respectively.

No other changes to `PropertyForm`.

---

## Data Flow

```
User types in address input
       ↓
Google Places dropdown appears (rendered by Google, appended to <body>)
       ↓
User selects a suggestion
       ↓
place_changed fires → parse address_components
       ↓
onChange(streetAddress) → updates address state in PropertyForm
onCityChange(city)      → updates city state in PropertyForm
onStateChange(state)    → updates state state in PropertyForm
       ↓
City and State inputs reflect new values (controlled inputs)
```

---

## Google API Notes

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is already configured in `.env.local` and `.env.example`.
- `@googlemaps/js-api-loader` (`^2.0.2`) is already installed.
- The `fields: ['address_components']` mask ensures only the cheapest Places API tier is used (no place details, no photos, no geometry).
- The Places library is loaded lazily on component mount — only when an admin opens the property form.
- Google appends a `.pac-container` div to `<body>` for the dropdown. This is handled automatically and requires no z-index workarounds in this context (the form is not inside a fixed/overflow-hidden ancestor that would clip it).

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Places library fails to load | Silent catch; input works as plain text |
| Selected place missing `locality` | `onCityChange` not called; city field unchanged |
| Selected place missing `administrative_area_level_1` | `onStateChange` not called; state field unchanged |
| Selected place missing `street_number` | Only `route` is used as the address value |

---

## Files Changed

| File | Change |
|---|---|
| `components/admin/PlacesAddressInput.tsx` | New component |
| `components/admin/PropertyForm.tsx` | Replace address `<input>` with `<PlacesAddressInput>` |

---

## Out of Scope

- Zip code auto-fill (no `zip` field exists on Property)
- Country field
- Lat/lng storage (geocoding still happens server-side per room page)
- Autocomplete on any field other than the street address
- Public-facing pages
