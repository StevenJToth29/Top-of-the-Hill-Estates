'use client'

import { useState } from 'react'
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline'

const PROPERTY_AMENITIES = [
  // Parking
  'Parking',
  'Garage Parking',
  'Street Parking',
  'EV Charging',
  // Outdoor & shared spaces
  'Backyard',
  'Patio / Deck',
  'Front Porch',
  'Pool',
  'Hot Tub',
  'BBQ Grill',
  'Fire Pit',
  'Outdoor Seating',
  // Shared laundry
  'Shared Laundry Room',
  'Coin Laundry On-Site',
  // Shared kitchen
  'Shared Kitchen',
  'Common Area',
  // Building access & security
  'Gated Entry',
  'Keyless Entry',
  'Doorbell Camera',
  'Security Camera (Exterior)',
  'On-Site Manager',
  'Package Receiving',
  // Utilities & billing
  'Utilities Included',
  'Water Included',
  'Electric Included',
  'Gas Included',
  'Trash Service',
  'Recycling',
  // Pet & family
  'Pet Friendly',
  'Dog Friendly',
  'Cat Friendly',
  'Child Friendly',
  'Fenced Yard',
  // Connectivity
  'WiFi Included',
  'Cable TV Included',
  // Accessibility
  'Wheelchair Accessible',
  'Elevator Access',
  'Step-Free Entry',
  'Accessible Parking',
]

const ROOM_AMENITIES = [
  // Bed & sleep
  'King Bed',
  'Queen Bed',
  'Full Bed',
  'Twin Bed',
  'Bunk Beds',
  'Memory Foam Mattress',
  'Linens Provided',
  'Extra Pillows & Blankets',
  'Blackout Curtains',
  // Bathroom
  'Private Bathroom',
  'Shared Bathroom',
  'En-Suite Bathroom',
  'Walk-in Shower',
  'Bathtub',
  'Towels Provided',
  'Hair Dryer',
  // Climate
  'AC',
  'Ceiling Fan',
  'Space Heater',
  'Window AC Unit',
  // Tech & entertainment
  'Smart TV',
  'Cable TV',
  'Streaming Services',
  'WiFi',
  'High-Speed Internet',
  'USB Charging Ports',
  // Workspace
  'Desk & Chair',
  'Ergonomic Chair',
  'Monitor',
  'Good Natural Light',
  // Storage & furniture
  'Closet',
  'Walk-in Closet',
  'Dresser',
  'Nightstands',
  'Full-Length Mirror',
  'Luggage Rack',
  // In-room conveniences
  'Mini Fridge',
  'Microwave',
  'Coffee Maker',
  'Electric Kettle',
  'Iron & Ironing Board',
  'In-Room Safe',
  'Smoke Detector',
  'Carbon Monoxide Detector',
  // Access
  'Private Entrance',
  'Keyed Lock',
  'In-Unit Washer/Dryer',
]

interface AmenitiesTagInputProps {
  value: string[]
  onChange: (amenities: string[]) => void
  context?: 'property' | 'room'
}

export default function AmenitiesTagInput({ value, onChange, context = 'property' }: AmenitiesTagInputProps) {
  const [inputValue, setInputValue] = useState('')

  const LIST = context === 'room' ? ROOM_AMENITIES : PROPERTY_AMENITIES

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

  const suggestions = LIST.filter(
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
