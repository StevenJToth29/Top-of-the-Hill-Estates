'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useRef } from 'react'
import type { Booking, Room, Property } from '@/types'
import { formatCurrency, formatDate, STATUS_BADGE } from '@/lib/format'
import clsx from 'clsx'

type BookingRow = Booking & { room: Room & { property: Property } }

export default function BookingsTable({
  bookings,
  selectedId,
}: {
  bookings: BookingRow[]
  selectedId?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const statusRef = useRef<HTMLSelectElement>(null)
  const fromRef = useRef<HTMLInputElement>(null)
  const toRef = useRef<HTMLInputElement>(null)
  const propertyRef = useRef<HTMLInputElement>(null)

  function pushParams(params: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString())
    Object.entries(params).forEach(([k, v]) => {
      if (v) next.set(k, v)
      else next.delete(k)
    })
    next.delete('id')
    router.push(`${pathname}?${next.toString()}`)
  }

  function applyFilters() {
    pushParams({
      status: statusRef.current?.value ?? '',
      from: fromRef.current?.value ?? '',
      to: toRef.current?.value ?? '',
      property: propertyRef.current?.value ?? '',
    })
  }

  function clearFilters() {
    router.push(pathname)
  }

  function selectBooking(id: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (next.get('id') === id) {
      next.delete('id')
    } else {
      next.set('id', id)
    }
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="bg-surface-container rounded-2xl overflow-hidden">
      <div className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-on-surface-variant">Status</label>
          <select
            ref={statusRef}
            defaultValue={searchParams.get('status') ?? ''}
            className="bg-surface-highest/40 rounded-xl px-4 py-2 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 outline-none"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-on-surface-variant">From</label>
          <input
            ref={fromRef}
            type="date"
            defaultValue={searchParams.get('from') ?? ''}
            className="bg-surface-highest/40 rounded-xl px-4 py-2 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-on-surface-variant">To</label>
          <input
            ref={toRef}
            type="date"
            defaultValue={searchParams.get('to') ?? ''}
            className="bg-surface-highest/40 rounded-xl px-4 py-2 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-on-surface-variant">Property</label>
          <input
            ref={propertyRef}
            type="text"
            placeholder="Filter by property"
            defaultValue={searchParams.get('property') ?? ''}
            className="bg-surface-highest/40 rounded-xl px-4 py-2 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 outline-none placeholder:text-on-surface-variant/50"
          />
        </div>

        <button
          onClick={applyFilters}
          className="rounded-xl bg-secondary/20 px-4 py-2 text-sm font-semibold text-secondary hover:bg-secondary/30 transition-colors"
        >
          Apply Filters
        </button>
        <button
          onClick={clearFilters}
          className="rounded-xl px-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Clear
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-on-surface-variant">
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Property</th>
              <th className="px-4 py-3">Check-in</th>
              <th className="px-4 py-3">Check-out</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Paid</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-on-surface-variant">
                  No bookings found.
                </td>
              </tr>
            )}
            {bookings.map((b) => (
              <tr
                key={b.id}
                onClick={() => selectBooking(b.id)}
                className={clsx(
                  'cursor-pointer transition-colors',
                  selectedId === b.id ? 'bg-surface-high/30' : 'hover:bg-surface-high/30',
                )}
              >
                <td className="px-4 py-3 text-on-surface whitespace-nowrap">
                  {b.guest_first_name} {b.guest_last_name}
                </td>
                <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                  {b.room?.name ?? '—'}
                </td>
                <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                  {b.room?.property?.name ?? '—'}
                </td>
                <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                  {formatDate(b.check_in)}
                </td>
                <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                  {formatDate(b.check_out)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="rounded-full px-3 py-1 text-xs font-semibold bg-surface-highest/40 text-on-surface-variant capitalize">
                    {b.booking_type === 'short_term' ? 'Short' : 'Long'}
                  </span>
                </td>
                <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                  {formatCurrency(b.amount_paid)}
                </td>
                <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                  {formatCurrency(b.amount_due_at_checkin)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={clsx(
                      'rounded-full px-3 py-1 text-xs font-semibold capitalize',
                      STATUS_BADGE[b.status],
                    )}
                  >
                    {b.status}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      selectBooking(b.id)
                    }}
                    className="text-secondary hover:text-secondary/80 text-xs font-semibold transition-colors"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
