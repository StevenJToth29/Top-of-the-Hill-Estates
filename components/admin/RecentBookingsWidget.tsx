'use client'

import { useState } from 'react'
import { format } from 'date-fns/format'
import { parseISO } from 'date-fns/parseISO'
import type { Booking, Room, Property } from '@/types'
import { STATUS_BADGE } from '@/lib/format'

export type BookingWithRoom = Booking & {
  room: Room & { property: Property }
}

interface RecentBookingsWidgetProps {
  bookings: BookingWithRoom[]
}

type SortKey = 'guest' | 'room' | 'check_in' | 'check_out' | 'booking_type' | 'total_amount' | 'status'
type SortDir = 'asc' | 'desc'

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'MMM d, yyyy')
}

function sortBookings(bookings: BookingWithRoom[], key: SortKey, dir: SortDir) {
  return [...bookings].sort((a, b) => {
    let av: string | number = ''
    let bv: string | number = ''
    if (key === 'guest') {
      av = `${a.guest_last_name} ${a.guest_first_name}`.toLowerCase()
      bv = `${b.guest_last_name} ${b.guest_first_name}`.toLowerCase()
    } else if (key === 'room') {
      av = (a.room?.name ?? '').toLowerCase()
      bv = (b.room?.name ?? '').toLowerCase()
    } else if (key === 'total_amount') {
      av = a.total_amount
      bv = b.total_amount
    } else {
      av = (a[key] as string).toLowerCase?.() ?? a[key]
      bv = (b[key] as string).toLowerCase?.() ?? b[key]
    }
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })
}

const COLUMNS: { label: string; key: SortKey }[] = [
  { label: 'Guest', key: 'guest' },
  { label: 'Room', key: 'room' },
  { label: 'Check-in', key: 'check_in' },
  { label: 'Check-out', key: 'check_out' },
  { label: 'Type', key: 'booking_type' },
  { label: 'Amount', key: 'total_amount' },
  { label: 'Status', key: 'status' },
]

export function RecentBookingsWidget({ bookings }: RecentBookingsWidgetProps) {
  const [sortKey, setSortKey] = useState<SortKey>('check_in')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortBookings(bookings, sortKey, sortDir)

  return (
    <div className="bg-surface-container rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(45,212,191,0.06)]">
      <div className="px-6 py-5">
        <h2 className="font-display text-lg font-semibold text-on-surface">
          Recent Bookings
        </h2>
      </div>

      {bookings.length === 0 ? (
        <div className="px-6 pb-6 text-on-surface-variant text-sm">
          No bookings yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {COLUMNS.map(({ label, key }) => {
                  const active = sortKey === key
                  return (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="px-6 py-3 text-left uppercase tracking-widest text-xs font-medium whitespace-nowrap cursor-pointer select-none group"
                    >
                      <span className={active ? 'text-secondary' : 'text-on-surface-variant group-hover:text-on-surface transition-colors'}>
                        {label}
                        <span className="ml-1 inline-block w-3 text-center">
                          {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                        </span>
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((booking) => (
                <tr
                  key={booking.id}
                  className="hover:bg-surface-high/40 transition-colors"
                >
                  <td className="px-6 py-4 text-on-surface whitespace-nowrap">
                    <a
                      href={`/admin/bookings?id=${booking.id}`}
                      className="hover:text-secondary transition-colors"
                    >
                      {booking.guest_first_name} {booking.guest_last_name}
                    </a>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                    <span className="block">{booking.room?.name ?? '—'}</span>
                    <span className="text-xs text-on-surface-variant/70">
                      {booking.room?.property?.name ?? ''}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                    {formatDate(booking.check_in)}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap">
                    {formatDate(booking.check_out)}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap capitalize">
                    {booking.booking_type.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4 text-on-surface whitespace-nowrap">
                    ${booking.total_amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[booking.status]}`}
                    >
                      {booking.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
