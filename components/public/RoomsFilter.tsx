'use client'

import { useRouter } from 'next/navigation'
import type { SearchParams } from '@/app/(public)/rooms/page'

const PROPERTIES = [
  { value: 'all', label: 'All Properties' },
  { value: 'northridge', label: 'Northridge' },
  { value: 'linden', label: 'Linden' },
  { value: 'mesa downtown', label: 'Mesa Downtown' },
]

export default function RoomsFilter({
  currentFilters,
}: {
  currentFilters: SearchParams
}) {
  const router = useRouter()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const params = new URLSearchParams()

    const property = data.get('property') as string
    const guests = data.get('guests') as string
    const type = data.get('type') as string
    const checkin = data.get('checkin') as string
    const checkout = data.get('checkout') as string

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
          <label
            htmlFor="filter-guests"
            className="uppercase tracking-widest text-xs text-secondary font-body"
          >
            Guests
          </label>
          <input
            id="filter-guests"
            type="number"
            name="guests"
            min={1}
            defaultValue={currentFilters.guests ?? ''}
            placeholder="Any"
            className="bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface font-body text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 placeholder:text-on-surface-variant/50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-checkin"
            className="uppercase tracking-widest text-xs text-secondary font-body"
          >
            Check-in
          </label>
          <input
            id="filter-checkin"
            type="date"
            name="checkin"
            defaultValue={currentFilters.checkin ?? ''}
            className="bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface font-body text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 [color-scheme:dark]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-checkout"
            className="uppercase tracking-widest text-xs text-secondary font-body"
          >
            Check-out
          </label>
          <input
            id="filter-checkout"
            type="date"
            name="checkout"
            defaultValue={currentFilters.checkout ?? ''}
            className="bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface font-body text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 [color-scheme:dark]"
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
          className="bg-gradient-to-r from-primary to-secondary text-background font-semibold font-body rounded-2xl px-6 py-2.5 shadow-[0_0_10px_rgba(175,201,234,0.30)] hover:opacity-90 transition-opacity"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => router.push('/rooms')}
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
