'use client'

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import type { SearchParams } from '@/app/(public)/rooms/page'
import DatePicker from './DatePicker'

const PROPERTIES = [
  { value: 'all', label: 'All Properties' },
  { value: 'northridge', label: 'Northridge' },
  { value: 'linden', label: 'Linden' },
  { value: 'mesa downtown', label: 'Mesa Downtown' },
]

const today = format(new Date(), 'yyyy-MM-dd')

export default function RoomsFilter({
  currentFilters,
}: {
  currentFilters: SearchParams
}) {
  const router = useRouter()
  const [checkin, setCheckin] = useState(currentFilters.checkin ?? '')
  const [checkout, setCheckout] = useState(currentFilters.checkout ?? '')
  const [guests, setGuests] = useState(currentFilters.guests ?? '')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const params = new URLSearchParams()

    const property = data.get('property') as string
    const type = data.get('type') as string

    if (property && property !== 'all') params.set('property', property)
    if (guests && parseInt(guests, 10) > 0) params.set('guests', guests)
    if (type) params.set('type', type)
    if (checkin) params.set('checkin', checkin)
    if (checkout) params.set('checkout', checkout)

    router.push(`/rooms${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const activeType = currentFilters.type ?? ''

  return (
    <form onSubmit={handleSubmit} className="bg-surface-container rounded-2xl p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-property"
            className="uppercase tracking-widest text-xs text-secondary font-body"
          >
            Property
          </label>
          <select
            id="filter-property"
            name="property"
            defaultValue={currentFilters.property ?? 'all'}
            className="bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface font-body text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 appearance-none cursor-pointer"
          >
            {PROPERTIES.map((p) => (
              <option
                key={p.value}
                value={p.value}
                className="bg-surface-highest text-on-surface"
              >
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="uppercase tracking-widest text-xs text-secondary font-body">Guests</span>
          <div className="flex gap-2">
            {(['', '1', '2'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setGuests(v)}
                className={[
                  'flex-1 py-2.5 rounded-xl text-sm font-body font-medium transition-colors',
                  guests === v
                    ? 'bg-secondary text-background'
                    : 'bg-surface-highest/40 text-on-surface-variant hover:bg-surface-high hover:text-on-surface',
                ].join(' ')}
              >
                {v === '' ? 'Any' : v === '1' ? '1 Guest' : '2 Guests'}
              </button>
            ))}
          </div>
        </div>

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
            min={checkin || today}
            placeholder="Any date"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="uppercase tracking-widest text-xs text-secondary font-body">
          Booking type
        </span>
        <BookingTypePill name="type" value="" activeValue={activeType} label="Any" />
        <BookingTypePill
          name="type"
          value="short_term"
          activeValue={activeType}
          label="Short-term"
        />
        <BookingTypePill
          name="type"
          value="long_term"
          activeValue={activeType}
          label="Long-term"
        />
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="submit"
          className="bg-gradient-to-r from-primary to-secondary text-background font-semibold font-body rounded-2xl px-6 py-2.5 shadow-[0_0_10px_rgba(45,212,191,0.30)] hover:opacity-90 transition-opacity"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => { setCheckin(''); setCheckout(''); setGuests(''); router.push('/rooms') }}
          className="text-on-surface-variant font-body text-sm underline underline-offset-2 hover:text-on-surface transition-colors"
        >
          Clear filters
        </button>
      </div>
    </form>
  )
}

function BookingTypePill({
  name,
  value,
  activeValue,
  label,
}: {
  name: string
  value: string
  activeValue: string
  label: string
}) {
  const isActive = activeValue === value
  return (
    <label
      className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-body transition-colors ${
        isActive
          ? 'bg-secondary text-background font-semibold'
          : 'bg-surface-highest/40 text-on-surface-variant hover:text-on-surface'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={isActive}
        className="sr-only"
      />
      {label}
    </label>
  )
}
