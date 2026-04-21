# Google Places Address Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Places Autocomplete to the street address field in `PropertyForm` so that selecting a suggestion auto-fills `address`, `city`, and `state`.

**Architecture:** A new `PlacesAddressInput` client component wraps the address `<input>` and attaches `google.maps.places.Autocomplete` on mount via the already-installed `@googlemaps/js-api-loader`. `PropertyForm` replaces its plain address input with this component. The parsing logic is extracted as a standalone exported function so it can be unit-tested without the browser API.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, `@googlemaps/js-api-loader` (already installed), Jest 30 + React Testing Library

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `components/admin/PlacesAddressInput.tsx` | Create | Autocomplete-enhanced address input; exports `parseAddressComponents` for testing |
| `__tests__/components/admin/PlacesAddressInput.test.tsx` | Create | Unit tests for `parseAddressComponents` and component render |
| `components/admin/PropertyForm.tsx` | Modify | Replace plain address `<input>` with `<PlacesAddressInput>` |

---

### Task 1: `PlacesAddressInput` component and tests

**Files:**
- Create: `components/admin/PlacesAddressInput.tsx`
- Create: `__tests__/components/admin/PlacesAddressInput.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/admin/PlacesAddressInput.test.tsx`:

```tsx
/** @jest-environment jsdom */

jest.mock('@googlemaps/js-api-loader', () => ({
  Loader: jest.fn().mockImplementation(() => ({
    importLibrary: jest.fn().mockResolvedValue({}),
  })),
}))

import { render, screen, fireEvent } from '@testing-library/react'
import { parseAddressComponents } from '@/components/admin/PlacesAddressInput'
import PlacesAddressInput from '@/components/admin/PlacesAddressInput'

// ─── parseAddressComponents tests ───────────────────────────────────────────

function makeComponent(type: string, longName: string, shortName = longName) {
  return { types: [type], long_name: longName, short_name: shortName }
}

describe('parseAddressComponents', () => {
  it('extracts street number + route as address', () => {
    const result = parseAddressComponents([
      makeComponent('street_number', '123'),
      makeComponent('route', 'Main St'),
      makeComponent('locality', 'Phoenix'),
      makeComponent('administrative_area_level_1', 'Arizona', 'AZ'),
    ])
    expect(result.address).toBe('123 Main St')
    expect(result.city).toBe('Phoenix')
    expect(result.state).toBe('AZ')
  })

  it('uses only route when street_number is absent', () => {
    const result = parseAddressComponents([
      makeComponent('route', 'Broadway'),
    ])
    expect(result.address).toBe('Broadway')
  })

  it('falls back to sublocality when locality is absent', () => {
    const result = parseAddressComponents([
      makeComponent('sublocality', 'Brooklyn'),
    ])
    expect(result.city).toBe('Brooklyn')
  })

  it('prefers locality over sublocality when both are present', () => {
    const result = parseAddressComponents([
      makeComponent('locality', 'New York'),
      makeComponent('sublocality', 'Manhattan'),
    ])
    expect(result.city).toBe('New York')
  })

  it('returns empty object when no matching components exist', () => {
    const result = parseAddressComponents([
      makeComponent('country', 'United States', 'US'),
    ])
    expect(result).toEqual({})
  })

  it('uses short_name for state', () => {
    const result = parseAddressComponents([
      makeComponent('administrative_area_level_1', 'Arizona', 'AZ'),
    ])
    expect(result.state).toBe('AZ')
  })
})

// ─── Component render tests ──────────────────────────────────────────────────

describe('PlacesAddressInput', () => {
  it('renders a text input with the given value', () => {
    render(
      <PlacesAddressInput
        value="123 Main St"
        onChange={jest.fn()}
        onCityChange={jest.fn()}
        onStateChange={jest.fn()}
        placeholder="Street address"
      />
    )
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('123 Main St')
    expect(input).toHaveAttribute('placeholder', 'Street address')
  })

  it('calls onChange when user types', () => {
    const onChange = jest.fn()
    render(
      <PlacesAddressInput
        value=""
        onChange={onChange}
        onCityChange={jest.fn()}
        onStateChange={jest.fn()}
      />
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '456 Oak Ave' } })
    expect(onChange).toHaveBeenCalledWith('456 Oak Ave')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/components/admin/PlacesAddressInput.test.tsx --no-coverage
```

Expected: FAIL — `Cannot find module '@/components/admin/PlacesAddressInput'`

- [ ] **Step 3: Create the component**

Create `components/admin/PlacesAddressInput.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { Loader } from '@googlemaps/js-api-loader'

export interface PlacesAddressInputProps {
  value: string
  onChange: (value: string) => void
  onCityChange: (city: string) => void
  onStateChange: (state: string) => void
  className?: string
  placeholder?: string
}

interface AddressComponent {
  types: string[]
  long_name: string
  short_name: string
}

export interface ParsedAddress {
  address?: string
  city?: string
  state?: string
}

export function parseAddressComponents(components: AddressComponent[]): ParsedAddress {
  const get = (type: string, nameType: 'long_name' | 'short_name'): string | undefined => {
    const comp = components.find((c) => c.types.includes(type))
    return comp ? comp[nameType] : undefined
  }

  const streetNumber = get('street_number', 'long_name')
  const route = get('route', 'long_name')
  const locality = get('locality', 'long_name') ?? get('sublocality', 'long_name')
  const adminArea = get('administrative_area_level_1', 'short_name')

  const result: ParsedAddress = {}
  if (route) result.address = streetNumber ? `${streetNumber} ${route}` : route
  if (locality) result.city = locality
  if (adminArea) result.state = adminArea

  return result
}

export default function PlacesAddressInput({
  value,
  onChange,
  onCityChange,
  onStateChange,
  className,
  placeholder,
}: PlacesAddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Stable refs for callbacks — avoids re-initialising autocomplete when parent re-renders
  const onChangeRef = useRef(onChange)
  const onCityChangeRef = useRef(onCityChange)
  const onStateChangeRef = useRef(onStateChange)
  useEffect(() => {
    onChangeRef.current = onChange
    onCityChangeRef.current = onCityChange
    onStateChangeRef.current = onStateChange
  })

  useEffect(() => {
    if (!inputRef.current) return

    let isMounted = true
    let listener: google.maps.MapsEventListener | undefined

    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
      libraries: ['places'],
    })

    loader
      .importLibrary('places')
      .then(() => {
        if (!isMounted || !inputRef.current) return

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: ['address_components'],
        })

        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          if (!place.address_components) return

          const parsed = parseAddressComponents(place.address_components)
          if (parsed.address !== undefined) onChangeRef.current(parsed.address)
          if (parsed.city !== undefined) onCityChangeRef.current(parsed.city)
          if (parsed.state !== undefined) onStateChangeRef.current(parsed.state)
        })
      })
      .catch(() => {
        // Graceful degradation — input works as plain text if Places fails to load
      })

    return () => {
      isMounted = false
      if (listener) google.maps.event.removeListener(listener)
    }
  }, []) // Intentionally empty — runs once on mount; callbacks accessed via refs

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/components/admin/PlacesAddressInput.test.tsx --no-coverage
```

Expected: all 8 tests PASS

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add components/admin/PlacesAddressInput.tsx __tests__/components/admin/PlacesAddressInput.test.tsx
git commit -m "feat: add PlacesAddressInput component with parseAddressComponents"
```

---

### Task 2: Wire `PlacesAddressInput` into `PropertyForm`

**Files:**
- Modify: `components/admin/PropertyForm.tsx` (lines 104–114 — the street address input block)

- [ ] **Step 1: Add the import**

In `components/admin/PropertyForm.tsx`, after the existing import on line 7:
```typescript
import AIWriteButton from './AIWriteButton'
```

Add:
```typescript
import PlacesAddressInput from './PlacesAddressInput'
```

- [ ] **Step 2: Replace the address `<input>` with `<PlacesAddressInput>`**

Replace the current address block (lines 104–114):

```tsx
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
```

With:

```tsx
        <div>
          <label className={labelClass}>Street Address</label>
          <PlacesAddressInput
            value={address}
            onChange={setAddress}
            onCityChange={setCity}
            onStateChange={setState}
            placeholder="123 Main St"
            className={inputClass}
          />
        </div>
```

Note: the `required` attribute is intentionally removed from the `<input>` inside `PlacesAddressInput` — it renders a plain `<input>` and the parent wraps it in a `<div>`, so HTML5 required validation still applies via the controlled value in the form.

Actually — `required` should be added to `PlacesAddressInput`'s props and passed through. Update the component props to accept it:

In `components/admin/PlacesAddressInput.tsx`, add `required?: boolean` to `PlacesAddressInputProps`:

```typescript
export interface PlacesAddressInputProps {
  value: string
  onChange: (value: string) => void
  onCityChange: (city: string) => void
  onStateChange: (state: string) => void
  className?: string
  placeholder?: string
  required?: boolean
}
```

And in the returned `<input>`:

```tsx
  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      required={required}
    />
  )
```

Then in `PropertyForm`, pass `required`:

```tsx
          <PlacesAddressInput
            value={address}
            onChange={setAddress}
            onCityChange={setCity}
            onStateChange={setState}
            required
            placeholder="123 Main St"
            className={inputClass}
          />
```

- [ ] **Step 3: Run full test suite**

```bash
npx jest --no-coverage
```

Expected: all tests pass

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add components/admin/PropertyForm.tsx components/admin/PlacesAddressInput.tsx
git commit -m "feat: wire PlacesAddressInput into PropertyForm for address autocomplete"
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|---|---|
| `PlacesAddressInput` component with `onChange`, `onCityChange`, `onStateChange` props | Task 1 |
| Load `places` library via `@googlemaps/js-api-loader` on mount | Task 1 |
| `types: ['address']`, `componentRestrictions: { country: 'us' }`, `fields: ['address_components']` | Task 1 |
| Parse `street_number` + `route` → address | Task 1 |
| Parse `locality` (fallback `sublocality`) → city | Task 1 |
| Parse `administrative_area_level_1` short_name → state | Task 1 |
| Skip callbacks for missing components | Task 1 |
| Graceful degradation on load failure | Task 1 |
| Cleanup listener on unmount | Task 1 |
| Use callback refs to avoid re-initialising on parent re-render | Task 1 |
| `PropertyForm` uses `PlacesAddressInput` instead of plain input | Task 2 |
| `required` prop passed through | Task 2 |
