/// <reference types="@types/google.maps" />
'use client'

import { useEffect, useRef } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

// Initialise once at module load — safe to call before any component mounts
setOptions({
  key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  libraries: ['places'],
})

export interface PlacesAddressInputProps {
  value: string
  onChange: (value: string) => void
  onCityChange: (city: string) => void
  onStateChange: (state: string) => void
  onZipChange?: (zip: string) => void
  className?: string
  placeholder?: string
  required?: boolean
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
  zip?: string
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
  const postalCode = get('postal_code', 'long_name')

  const result: ParsedAddress = {}
  if (route) result.address = streetNumber ? `${streetNumber} ${route}` : route
  if (locality) result.city = locality
  if (adminArea) result.state = adminArea
  if (postalCode) result.zip = postalCode

  return result
}

export default function PlacesAddressInput({
  value,
  onChange,
  onCityChange,
  onStateChange,
  onZipChange,
  className,
  placeholder,
  required,
}: PlacesAddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Stable refs for callbacks — avoids re-initialising autocomplete when parent re-renders
  const onChangeRef = useRef(onChange)
  const onCityChangeRef = useRef(onCityChange)
  const onStateChangeRef = useRef(onStateChange)
  const onZipChangeRef = useRef(onZipChange)
  // Mutate during render — safe for refs, keeps Autocomplete initialisation stable
  onChangeRef.current = onChange
  onCityChangeRef.current = onCityChange
  onStateChangeRef.current = onStateChange
  onZipChangeRef.current = onZipChange

  useEffect(() => {
    if (!inputRef.current) return

    let isMounted = true
    let listener: google.maps.MapsEventListener | undefined

    importLibrary('places')
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
          if (parsed.zip !== undefined) onZipChangeRef.current?.(parsed.zip)
        })
      })
      .catch((err: unknown) => {
        // Graceful degradation — input works as plain text if Places fails to load
        if (process.env.NODE_ENV !== 'production') console.warn('[PlacesAddressInput] Places failed to load:', err)
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
      required={required}
    />
  )
}
