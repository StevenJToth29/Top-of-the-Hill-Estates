'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

export default function HeroSearch() {
  const router = useRouter()
  const [location, setLocation] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState('1')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (location) params.set('property', location)
    if (checkIn) params.set('checkin', checkIn)
    if (checkOut) params.set('checkout', checkOut)
    if (guests && guests !== '1') params.set('guests', guests)
    router.push(`/rooms${params.toString() ? `?${params}` : ''}`)
  }

  return (
    <form
      onSubmit={handleSearch}
      className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] p-2 flex flex-col md:flex-row items-stretch md:items-center gap-1"
    >
      {/* Location */}
      <div className="flex-1 px-4 py-3 min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Location</p>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Mesa or Tempe, AZ"
          className="w-full text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
        />
      </div>

      <div className="hidden md:block w-px bg-gray-200 self-stretch my-2" />

      {/* Check In */}
      <div className="flex-1 px-4 py-3 min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Check In</p>
        <input
          type="date"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
          className="w-full text-sm text-slate-900 outline-none bg-transparent [color-scheme:light]"
        />
      </div>

      <div className="hidden md:block w-px bg-gray-200 self-stretch my-2" />

      {/* Check Out */}
      <div className="flex-1 px-4 py-3 min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Check Out</p>
        <input
          type="date"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          className="w-full text-sm text-slate-900 outline-none bg-transparent [color-scheme:light]"
        />
      </div>

      <div className="hidden md:block w-px bg-gray-200 self-stretch my-2" />

      {/* Guests */}
      <div className="flex-1 px-4 py-3 min-w-0">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Guests</p>
        <select
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
          className="w-full text-sm text-slate-900 outline-none bg-transparent"
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={String(n)}>
              {n} {n === 1 ? 'Guest' : 'Guests'}
            </option>
          ))}
        </select>
      </div>

      {/* Search button */}
      <button
        type="submit"
        className="flex items-center gap-2 bg-primary text-white font-semibold rounded-xl px-6 py-3 text-sm hover:bg-secondary transition-colors whitespace-nowrap"
      >
        <MagnifyingGlassIcon className="h-4 w-4" />
        Search Rooms
      </button>
    </form>
  )
}
