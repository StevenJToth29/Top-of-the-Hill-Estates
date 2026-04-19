'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import type { Booking, Room, Property } from '@/types'
import { formatCurrency, formatDate, STATUS_BADGE } from '@/lib/format'
import clsx from 'clsx'

type BookingRow = Booking & { room: Room & { property: Property } }
type SortKey = 'guest' | 'room' | 'property' | 'check_in' | 'check_out' | 'booking_type' | 'amount_paid' | 'amount_due_at_checkin' | 'status'
type SortDir = 'asc' | 'desc'

function sortBookings(bookings: BookingRow[], key: SortKey, dir: SortDir) {
  return [...bookings].sort((a, b) => {
    let av: string | number = ''
    let bv: string | number = ''
    if (key === 'guest') {
      av = `${a.guest_last_name} ${a.guest_first_name}`.toLowerCase()
      bv = `${b.guest_last_name} ${b.guest_first_name}`.toLowerCase()
    } else if (key === 'room') {
      av = (a.room?.name ?? '').toLowerCase()
      bv = (b.room?.name ?? '').toLowerCase()
    } else if (key === 'property') {
      av = (a.room?.property?.name ?? '').toLowerCase()
      bv = (b.room?.property?.name ?? '').toLowerCase()
    } else if (key === 'amount_paid' || key === 'amount_due_at_checkin') {
      av = a[key]
      bv = b[key]
    } else {
      av = (a[key] as string).toLowerCase?.() ?? String(a[key])
      bv = (b[key] as string).toLowerCase?.() ?? String(b[key])
    }
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })
}

const filterInputClass =
  'bg-surface-highest/40 rounded-xl px-4 py-2 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50 outline-none'

const COLUMNS: { label: string; key: SortKey }[] = [
  { label: 'Guest',    key: 'guest' },
  { label: 'Room',     key: 'room' },
  { label: 'Property', key: 'property' },
  { label: 'Check-in', key: 'check_in' },
  { label: 'Check-out',key: 'check_out' },
  { label: 'Type',     key: 'booking_type' },
  { label: 'Paid',     key: 'amount_paid' },
  { label: 'Due',      key: 'amount_due_at_checkin' },
  { label: 'Status',   key: 'status' },
]

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
  const propertyRef = useRef<HTMLInputElement>(null)
  const [from, setFrom] = useState(searchParams.get('from') ?? '')
  const [to, setTo] = useState(searchParams.get('to') ?? '')

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
      from,
      to,
      property: propertyRef.current?.value ?? '',
    })
  }

  function clearFilters() {
    setFrom('')
    setTo('')
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

  const sorted = sortBookings(bookings, sortKey, sortDir)

  return (
    <div className="bg-surface-container rounded-2xl overflow-hidden">
      {/* Filters */}
      <div className="p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-on-surface-variant">Status</label>
          <select
            ref={statusRef}
            defaultValue={searchParams.get('status') ?? ''}
            className={filterInputClass}
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
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={filterInputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-on-surface-variant">To</label>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className={filterInputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-on-surface-variant">Property</label>
          <input
            ref={propertyRef}
            type="text"
            placeholder="Filter by property"
            defaultValue={searchParams.get('property') ?? ''}
            className={`${filterInputClass} placeholder:text-on-surface-variant/50`}
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-on-surface-variant">
              {COLUMNS.map(({ label, key }) => {
                const active = sortKey === key
                return (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-4 py-3 cursor-pointer select-none whitespace-nowrap group"
                  >
                    <span className={active ? 'text-secondary' : 'group-hover:text-on-surface transition-colors'}>
                      {label}
                      <span className="ml-1 inline-block w-3 text-center">
                        {active ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </span>
                    </span>
                  </th>
                )
              })}
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-on-surface-variant">
                  No bookings found.
                </td>
              </tr>
            )}
            {sorted.map((b) => (
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
                  <span className={clsx('rounded-full px-3 py-1 text-xs font-semibold capitalize', STATUS_BADGE[b.status])}>
                    {b.status}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    onClick={(e) => { e.stopPropagation(); selectBooking(b.id) }}
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
