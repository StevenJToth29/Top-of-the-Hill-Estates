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
  today?: string
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
  { label: 'Amount / Net', key: 'total_amount' },
  { label: 'Status', key: 'status' },
]

export function RecentBookingsWidget({ bookings, today }: RecentBookingsWidgetProps) {
  const [sortKey, setSortKey] = useState<SortKey>('check_in')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortBookings(bookings, sortKey, sortDir)

  return (
    <div
      className="overflow-hidden rounded-xl border bg-white shadow-sm"
      style={{ borderColor: '#E2E8F0' }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid #F1F5F9' }}
      >
        <h2 className="font-display text-[15px] font-[800]" style={{ color: '#0F172A' }}>
          Recent Bookings
        </h2>
        <span className="text-xs" style={{ color: '#94A3B8' }}>
          {bookings.length} total
        </span>
      </div>

      {bookings.length === 0 ? (
        <div className="px-5 py-5 text-sm" style={{ color: '#94A3B8' }}>
          No bookings yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {COLUMNS.map(({ label, key }) => {
                  const active = sortKey === key
                  return (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.05em]"
                      style={{
                        color: active ? '#1FB2A0' : '#94A3B8',
                        borderBottom: '1px solid #F1F5F9',
                        background: '#F8FAFC',
                      }}
                    >
                      {label}
                      {active && (
                        <span className="ml-1 inline-block w-3 text-center">
                          {sortDir === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </th>
                  )
                })}
                <th
                  className="whitespace-nowrap px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.05em]"
                  style={{
                    color: '#94A3B8',
                    borderBottom: '1px solid #F1F5F9',
                    background: '#F8FAFC',
                  }}
                >
                  Outstanding
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(booking => {
                const isCheckinToday = today && booking.check_in === today
                const isCheckoutToday = today && booking.check_out === today
                const outstanding = Math.max(
                  0,
                  (booking.total_amount ?? 0) - (booking.amount_paid ?? 0),
                )
                return (
                  <tr
                    key={booking.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid #F8FAFC' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFC')}
                    onMouseLeave={e => ((e.currentTarget as HTMLTableRowElement).style.background = '')}
                  >
                    <td className="px-4 py-3 text-[13px] font-semibold" style={{ color: '#0F172A' }}>
                      <a
                        href={`/admin/bookings?id=${booking.id}`}
                        className="flex items-center gap-2 hover:opacity-75 transition-opacity"
                      >
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-[800]"
                          style={{
                            background: 'rgba(45,212,191,0.1)',
                            color: '#1FB2A0',
                            fontFamily: 'Manrope, sans-serif',
                          }}
                        >
                          {booking.guest_first_name.charAt(0)}{booking.guest_last_name.charAt(0)}
                        </div>
                        <div>
                          <div>{booking.guest_first_name} {booking.guest_last_name}</div>
                          <div className="text-[11px] font-normal" style={{ color: '#94A3B8' }}>
                            {booking.guest_email}
                          </div>
                        </div>
                      </a>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="block text-[13px] font-semibold" style={{ color: '#1FB2A0' }}>
                        {booking.room?.name ?? '—'}
                      </span>
                      <span className="text-[11px]" style={{ color: '#94A3B8' }}>
                        {booking.room?.property?.name ?? ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[13px]"
                        style={
                          isCheckinToday
                            ? {
                                background: 'rgba(45,212,191,0.08)',
                                color: '#1FB2A0',
                                fontWeight: 700,
                              }
                            : { color: '#64748B' }
                        }
                      >
                        {formatDate(booking.check_in)}
                        {isCheckinToday && ' · Today'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[13px]"
                        style={
                          isCheckoutToday
                            ? {
                                background: 'rgba(217,119,6,0.08)',
                                color: '#D97706',
                                fontWeight: 700,
                              }
                            : { color: '#64748B' }
                        }
                      >
                        {formatDate(booking.check_out)}
                        {isCheckoutToday && ' · Today'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="rounded-full px-2 py-0.5 text-[12px]"
                        style={{ background: '#F1F5F9', color: '#64748B' }}
                      >
                        {booking.booking_type === 'short_term' ? 'Short' : 'Long'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {(() => {
                        const gross = booking.total_amount ?? 0
                        const fee = booking.processing_fee ?? 0
                        const net = gross - fee
                        return (
                          <div className="space-y-0.5">
                            <div className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>
                              ${net.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </div>
                            {fee > 0 && (
                              <>
                                <div className="text-[11px]" style={{ color: '#94A3B8' }}>
                                  Gross ${gross.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                </div>
                                <div className="text-[11px]" style={{ color: '#DC2626' }}>
                                  −${fee.toLocaleString('en-US', { maximumFractionDigits: 2 })} fee
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[booking.status]}`}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 whitespace-nowrap text-right text-[13px] font-semibold"
                      style={{ color: outstanding > 0 ? '#DC2626' : '#059669' }}
                    >
                      {outstanding > 0
                        ? `$${outstanding.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                        : '–'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
