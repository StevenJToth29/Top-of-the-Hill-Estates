'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format, addDays, parseISO } from 'date-fns'
import { AdjustmentsHorizontalIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import type { SearchParams } from '@/app/(public)/rooms/page'
import DatePicker from './DatePicker'

const today = format(new Date(), 'yyyy-MM-dd')

const AMENITY_OPTIONS = [
  // Bed & sleep
  'King Bed', 'Queen Bed', 'Full Bed', 'Twin Bed', 'Bunk Beds',
  'Memory Foam Mattress', 'Linens Provided', 'Extra Pillows & Blankets', 'Blackout Curtains',
  // Bathroom
  'Private Bathroom', 'Shared Bathroom', 'En-Suite Bathroom',
  'Walk-in Shower', 'Bathtub', 'Towels Provided', 'Hair Dryer',
  // Climate
  'AC', 'Ceiling Fan', 'Space Heater', 'Window AC Unit',
  // Tech & entertainment
  'Smart TV', 'Cable TV', 'Streaming Services', 'WiFi', 'High-Speed Internet', 'USB Charging Ports',
  // Workspace
  'Desk & Chair', 'Ergonomic Chair', 'Monitor', 'Good Natural Light',
  // Storage & furniture
  'Closet', 'Walk-in Closet', 'Dresser', 'Nightstands', 'Full-Length Mirror', 'Luggage Rack',
  // In-room conveniences
  'Mini Fridge', 'Microwave', 'Coffee Maker', 'Electric Kettle',
  'Iron & Ironing Board', 'In-Room Safe', 'Smoke Detector', 'Carbon Monoxide Detector',
  // Access
  'Private Entrance', 'Keyed Lock', 'In-Unit Washer/Dryer',
  // Parking
  'Parking', 'Garage Parking', 'Street Parking', 'EV Charging',
  // Outdoor & shared spaces
  'Backyard', 'Patio / Deck', 'Front Porch', 'Pool', 'Hot Tub',
  'BBQ Grill', 'Fire Pit', 'Outdoor Seating',
  // Shared laundry & kitchen
  'Shared Laundry Room', 'Coin Laundry On-Site', 'Shared Kitchen', 'Common Area',
  // Building access & security
  'Gated Entry', 'Keyless Entry', 'Doorbell Camera', 'Security Camera (Exterior)',
  'On-Site Manager', 'Package Receiving',
  // Utilities & billing
  'Utilities Included', 'Water Included', 'Electric Included', 'Gas Included',
  'Trash Service', 'Recycling', 'WiFi Included', 'Cable TV Included',
  // Pet & family
  'Pet Friendly', 'Dog Friendly', 'Cat Friendly', 'Child Friendly', 'Fenced Yard',
  // Accessibility
  'Wheelchair Accessible', 'Elevator Access', 'Step-Free Entry', 'Accessible Parking',
]

export default function RoomsFilter({
  currentFilters,
}: {
  currentFilters: SearchParams
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [checkin, setCheckin] = useState(currentFilters.checkin ?? '')
  const [checkout, setCheckout] = useState(currentFilters.checkout ?? '')
  const [guests, setGuests] = useState(currentFilters.guests ?? '')
  const [bookingType, setBookingType] = useState(currentFilters.type ?? '')
  const [maxPrice, setMaxPrice] = useState(currentFilters.max_price ?? '')
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(
    currentFilters.amenities
      ? currentFilters.amenities.split(',').map((a) => a.trim()).filter(Boolean)
      : [],
  )

  const [amenityInput, setAmenityInput] = useState('')
  const [amenityDropdownOpen, setAmenityDropdownOpen] = useState(false)
  const amenityInputRef = useRef<HTMLInputElement>(null)
  const amenityContainerRef = useRef<HTMLDivElement>(null)

  const isFirstRender = useRef(true)

  const activeFilterCount = [
    guests,
    bookingType,
    maxPrice,
    ...selectedAmenities,
  ].filter(Boolean).length

  useEffect(() => {
    if (activeFilterCount > 0) setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (amenityContainerRef.current && !amenityContainerRef.current.contains(e.target as Node)) {
        setAmenityDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Auto-search on filter change, debounced 300ms
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (guests && parseInt(guests, 10) > 0) params.set('guests', guests)
      if (bookingType) params.set('type', bookingType)
      if (checkin) params.set('checkin', checkin)
      if (checkout) params.set('checkout', checkout)
      if (maxPrice) params.set('max_price', maxPrice)
      if (selectedAmenities.length > 0) params.set('amenities', selectedAmenities.join(','))
      router.push(`/rooms${params.toString() ? `?${params.toString()}` : ''}`)
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkin, checkout, guests, bookingType, maxPrice, selectedAmenities])

  const filteredOptions = AMENITY_OPTIONS.filter(
    (a) =>
      a.toLowerCase().includes(amenityInput.toLowerCase()) &&
      !selectedAmenities.includes(a),
  )

  const inputTrimmed = amenityInput.trim()
  const showCustomOption =
    inputTrimmed.length > 0 &&
    !AMENITY_OPTIONS.some((a) => a.toLowerCase() === inputTrimmed.toLowerCase()) &&
    !selectedAmenities.includes(inputTrimmed)

  function addAmenity(amenity: string) {
    const trimmed = amenity.trim()
    if (trimmed && !selectedAmenities.includes(trimmed)) {
      setSelectedAmenities((prev) => [...prev, trimmed])
    }
    setAmenityInput('')
    setAmenityDropdownOpen(false)
    amenityInputRef.current?.focus()
  }

  function removeAmenity(amenity: string) {
    setSelectedAmenities((prev) => prev.filter((a) => a !== amenity))
  }

  function handleAmenityKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredOptions.length > 0) {
        addAmenity(filteredOptions[0])
      } else if (showCustomOption) {
        addAmenity(inputTrimmed)
      }
    } else if (e.key === 'Escape') {
      setAmenityDropdownOpen(false)
    } else if (e.key === 'Backspace' && amenityInput === '' && selectedAmenities.length > 0) {
      removeAmenity(selectedAmenities[selectedAmenities.length - 1])
    }
  }

  function handleClear() {
    setBookingType('')
    setMaxPrice('')
    setSelectedAmenities([])
  }

  const priceLabel = bookingType === 'long_term' ? 'Max price / mo' : 'Max price / night'

  return (
    <div className="space-y-3">
      {/* Row 1: Dates + Guests — always visible */}
      <div className="bg-surface-container rounded-2xl p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-highest/40 rounded-xl px-4 py-3">
            <DatePicker
              label="Check-in"
              value={checkin}
              onChange={(d) => {
                setCheckin(d)
                if (checkout && checkout <= d) setCheckout('')
              }}
              min={today}
              placeholder="Any date"
            />
          </div>

          <div className="bg-surface-highest/40 rounded-xl px-4 py-3">
            <DatePicker
              label="Check-out"
              value={checkout}
              onChange={setCheckout}
              min={checkin ? format(addDays(parseISO(checkin), 1), 'yyyy-MM-dd') : today}
              placeholder="Any date"
            />
          </div>

          <div className="bg-surface-highest/40 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Guests</p>
            <div className="flex gap-1.5">
              {(['', '1', '2'] as const).map((v) => (
                <FilterPill key={v} active={guests === v} onClick={() => setGuests(v)}>
                  {v === '' ? 'Any' : v}
                </FilterPill>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toggle bar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold font-body bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <AdjustmentsHorizontalIcon className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-background text-[10px] font-bold leading-none">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1 text-on-surface-variant font-body text-sm hover:text-on-surface transition-colors"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {/* Collapsible filter panel */}
      {open && (
        <div className="bg-surface-container rounded-2xl p-6 space-y-4">
          {/* Booking Type + Max Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-highest/40 rounded-xl px-4 py-3 sm:col-span-2">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Booking Type</p>
              <div className="flex gap-1.5 flex-wrap">
                {([['', 'Any'], ['short_term', 'Short-term'], ['long_term', 'Long-term']] as const).map(([v, label]) => (
                  <FilterPill key={v} active={bookingType === v} onClick={() => setBookingType(v)}>
                    {label}
                  </FilterPill>
                ))}
              </div>
            </div>

            <div className="bg-surface-highest/40 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                {priceLabel}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-on-surface-variant text-sm font-body">$</span>
                <input
                  type="number"
                  min={0}
                  step={bookingType === 'long_term' ? 50 : 5}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="No limit"
                  className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Amenities autocomplete */}
          <div className="bg-surface-highest/40 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">Amenities</p>

            <div ref={amenityContainerRef} className="relative">
              {/* Selected chips + input */}
              <div
                className="flex flex-wrap gap-2 min-h-[2.25rem] cursor-text"
                onClick={() => amenityInputRef.current?.focus()}
              >
                {selectedAmenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="flex items-center gap-1 bg-primary/15 border border-primary text-primary text-sm font-body rounded-full px-3 py-1"
                  >
                    {amenity}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeAmenity(amenity) }}
                      className="text-primary/60 hover:text-primary transition-colors"
                      aria-label={`Remove ${amenity}`}
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                  <MagnifyingGlassIcon className="w-3.5 h-3.5 text-on-surface-variant/50 shrink-0" />
                  <input
                    ref={amenityInputRef}
                    type="text"
                    value={amenityInput}
                    onChange={(e) => { setAmenityInput(e.target.value); setAmenityDropdownOpen(true) }}
                    onFocus={() => setAmenityDropdownOpen(true)}
                    onKeyDown={handleAmenityKeyDown}
                    placeholder={selectedAmenities.length === 0 ? 'Search amenities…' : 'Add more…'}
                    className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none"
                  />
                </div>
              </div>

              {/* Dropdown */}
              {amenityDropdownOpen && (filteredOptions.length > 0 || showCustomOption) && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-surface-container border border-outline-variant/30 rounded-xl shadow-lg overflow-hidden">
                  <ul className="max-h-52 overflow-y-auto py-1">
                    {filteredOptions.map((option) => (
                      <li key={option}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); addAmenity(option) }}
                          className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-highest/60 transition-colors"
                        >
                          {option}
                        </button>
                      </li>
                    ))}
                    {showCustomOption && (
                      <li>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); addAmenity(inputTrimmed) }}
                          className="w-full text-left px-4 py-2 text-sm text-primary hover:bg-surface-highest/60 transition-colors"
                        >
                          Add &ldquo;{inputTrimmed}&rdquo;
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1 rounded-lg text-sm font-body font-medium transition-colors',
        active
          ? 'bg-primary text-white'
          : 'bg-transparent text-on-surface-variant hover:bg-surface-high hover:text-on-surface',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
