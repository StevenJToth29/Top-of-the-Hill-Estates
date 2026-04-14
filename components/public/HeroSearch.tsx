'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { format, addDays, parseISO } from 'date-fns'
import DatePicker from './DatePicker'

export default function HeroSearch() {
  const router = useRouter()
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState('1')

  const today = format(new Date(), 'yyyy-MM-dd')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (checkIn) params.set('checkin', checkIn)
    if (checkOut) params.set('checkout', checkOut)
    if (guests && guests !== '1') params.set('guests', guests)
    router.push(`/rooms${params.toString() ? `?${params}` : ''}`)
  }

  return (
    <form
      onSubmit={handleSearch}
      className="w-full bg-background rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] p-2 flex flex-col md:flex-row items-stretch md:items-center gap-1"
    >
      {/* Check In */}
      <div className="flex-1 px-4 py-3 min-w-0">
        <DatePicker
          label="Check In"
          value={checkIn}
          onChange={(d) => {
            setCheckIn(d)
            // Clear check-out if it's now before check-in
            if (checkOut && d && checkOut <= d) setCheckOut('')
          }}
          min={today}
          placeholder="Add date"
        />
      </div>

      <div className="hidden md:block w-px bg-surface self-stretch my-2" />

      {/* Check Out */}
      <div className="flex-1 px-4 py-3 min-w-0">
        <DatePicker
          label="Check Out"
          value={checkOut}
          onChange={setCheckOut}
          min={checkIn ? format(addDays(parseISO(checkIn), 1), 'yyyy-MM-dd') : today}
          placeholder="Add date"
        />
      </div>

      <div className="hidden md:block w-px bg-surface self-stretch my-2" />

      {/* Guests */}
      <div className="px-4 py-3 shrink-0">
        <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Guests</p>
        <div className="flex gap-1.5">
          {[1, 2].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setGuests(String(n))}
              className={[
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                guests === String(n)
                  ? 'bg-primary text-white'
                  : 'bg-surface text-on-surface-variant hover:bg-surface-high hover:text-on-surface',
              ].join(' ')}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Search button */}
      <button
        type="submit"
        className="flex items-center gap-2 bg-primary text-white font-semibold rounded-xl px-6 py-3 text-sm hover:bg-secondary transition-colors duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <MagnifyingGlassIcon className="h-4 w-4" />
        Search Rooms
      </button>
    </form>
  )
}
