'use client'

import { useState } from 'react'
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline'

const COMMON_AMENITIES = [
  // Connectivity & tech
  'WiFi',
  'High-Speed Internet',
  'Cable TV',
  'Smart TV',
  'Streaming Services',
  'Desk & Workspace',
  // Climate & comfort
  'AC',
  'Central Heat',
  'Ceiling Fan',
  'Blackout Curtains',
  // Kitchen & food
  'Kitchen Access',
  'Full Kitchen',
  'Microwave',
  'Coffee Maker',
  'Dishwasher',
  'Refrigerator',
  // Laundry
  'Laundry',
  'In-Unit Washer/Dryer',
  'Washer/Dryer Access',
  // Parking & access
  'Parking',
  'Garage Parking',
  'Street Parking',
  'Private Entrance',
  'Keyless Entry',
  // Outdoor & shared
  'Backyard',
  'Patio / Deck',
  'Pool Access',
  'Hot Tub',
  'BBQ Grill',
  'Fire Pit',
  // Bathroom
  'Private Bathroom',
  'Shared Bathroom',
  'Walk-in Shower',
  'Bathtub',
  'Towels Included',
  // Pet & family
  'Pet Friendly',
  'Dog Friendly',
  'Cat Friendly',
  'Child Friendly',
  // Utilities & billing
  'Utilities Included',
  'Water Included',
  'Electric Included',
  'Gas Included',
  'Trash Service',
  // Furnished & setup
  'Furnished',
  'Partially Furnished',
  'Linens Provided',
  'Storage Space',
  'Closet / Wardrobe',
  // Safety
  'Smoke Detector',
  'Carbon Monoxide Detector',
  'Fire Extinguisher',
  'Security Camera (Exterior)',
  'Deadbolt Lock',
  // Accessibility
  'Wheelchair Accessible',
  'Elevator Access',
  'Step-Free Entry',
]

interface AmenitiesTagInputProps {
  value: string[]
  onChange: (amenities: string[]) => void
}

export default function AmenitiesTagInput({ value, onChange }: AmenitiesTagInputProps) {
  const [inputValue, setInputValue] = useState('')

  function addAmenity(amenity: string) {
    const trimmed = amenity.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInputValue('')
  }

  function removeAmenity(amenity: string) {
    onChange(value.filter((a) => a !== amenity))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addAmenity(inputValue)
    }
  }

  const suggestions = COMMON_AMENITIES.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase()),
  )

  return (
    <div className="space-y-3">
      {/* Current amenities */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((amenity) => (
            <span
              key={amenity}
              className="flex items-center gap-1.5 bg-surface-container rounded-full px-3 py-1 text-on-surface-variant text-sm"
            >
              {amenity}
              <button
                type="button"
                onClick={() => removeAmenity(amenity)}
                className="text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
                aria-label={`Remove ${amenity}`}
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add amenity..."
          className="flex-1 bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50 text-sm"
        />
        <button
          type="button"
          onClick={() => addAmenity(inputValue)}
          disabled={!inputValue.trim()}
          className="flex items-center gap-1.5 bg-surface-container rounded-xl px-4 py-3 text-on-surface-variant text-sm hover:bg-surface-high transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PlusIcon className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-on-surface-variant/60 self-center">Suggestions:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addAmenity(s)}
              className="bg-surface-highest/20 border border-outline-variant rounded-full px-3 py-1 text-on-surface-variant/70 text-xs hover:bg-surface-container hover:text-on-surface-variant transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
