'use client'

import { useMemo, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { formatCurrency, formatDate, OPEN_ENDED_DATE } from '@/lib/format'
import type { Booking, Room, Property } from '@/types'
import NewManualBookingButton from './NewManualBookingButton'
import CancelBookingModal from './CancelBookingModal'
import { DEFAULT_POLICY } from '@/lib/cancellation'

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingRow = Booking & { room: Room & { property: Property } }
type SortKey = 'guest' | 'room' | 'check_in' | 'check_out' | 'booking_type' | 'total_amount' | 'status'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'confirmed' | 'pending' | 'cancelled'
type TypeFilter = 'all' | 'short_term' | 'long_term'

// ─── Module-level constants ───────────────────────────────────────────────────

const todayStr = new Date().toISOString().split('T')[0]

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  confirmed: {
    color: '#059669',
    bg: 'rgba(5,150,105,0.08)',
    border: 'rgba(5,150,105,0.2)',
    label: 'Confirmed',
  },
  pending: {
    color: '#D97706',
    bg: 'rgba(217,119,6,0.08)',
    border: 'rgba(217,119,6,0.2)',
    label: 'Pending',
  },
  cancelled: {
    color: '#DC2626',
    bg: 'rgba(220,38,38,0.07)',
    border: 'rgba(220,38,38,0.18)',
    label: 'Cancelled',
  },
  completed: {
    color: '#2563EB',
    bg: 'rgba(37,99,235,0.07)',
    border: 'rgba(37,99,235,0.2)',
    label: 'Completed',
  },
  expired: {
    color: '#94A3B8',
    bg: 'rgba(148,163,184,0.1)',
    border: 'rgba(148,163,184,0.2)',
    label: 'Expired',
  },
}

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  direct: { label: 'Direct', color: '#1FB2A0', bg: 'rgba(45,212,191,0.08)' },
  airbnb: { label: 'Airbnb', color: '#E61E4D', bg: 'rgba(230,30,77,0.07)' },
  vrbo: { label: 'VRBO', color: '#1C6AB1', bg: 'rgba(28,106,177,0.08)' },
  'booking.com': { label: 'Booking.com', color: '#003580', bg: 'rgba(0,53,128,0.07)' },
  other: { label: 'Other', color: '#64748B', bg: '#F1F5F9' },
}

function getSrc(source: string | null | undefined) {
  if (!source) return SOURCE_CONFIG.direct
  const key = source.toLowerCase()
  return SOURCE_CONFIG[key] ?? { label: source.charAt(0).toUpperCase() + source.slice(1), color: '#64748B', bg: '#F1F5F9' }
}

function getStatus(status: string) {
  return STATUS_CONFIG[status] ?? { color: '#94A3B8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', label: status }
}

// ─── PayBar (outside BookingsClient) ─────────────────────────────────────────

function PayBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
  const owed = total - paid

  let labelText: string
  let labelColor: string
  let barColor: string

  if (pct >= 100) {
    labelText = 'Paid'
    labelColor = '#059669'
    barColor = '#059669'
  } else if (pct === 0) {
    labelText = 'Unpaid'
    labelColor = '#DC2626'
    barColor = '#DC2626'
  } else {
    labelText = `${pct}%`
    labelColor = '#D97706'
    barColor = '#D97706'
  }

  return (
    <div className="flex flex-col gap-1 min-w-[80px]">
      <div className="flex items-center gap-1.5">
        <span style={{ color: labelColor }} className="text-[12px] font-bold leading-none">
          {labelText}
        </span>
        {owed > 0 && (
          <span style={{ color: '#94A3B8' }} className="text-[10px] leading-none">
            owes {formatCurrency(owed)}
          </span>
        )}
      </div>
      <div
        style={{ background: '#E2E8F0' }}
        className="h-[3px] w-full rounded-full overflow-hidden"
      >
        <div
          style={{ width: `${pct}%`, background: barColor }}
          className="h-full rounded-full transition-all"
        />
      </div>
    </div>
  )
}

// ─── SortTH (outside BookingsClient) ─────────────────────────────────────────

function SortTH({
  label,
  sortKey,
  activeKey,
  sortDir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
  className?: string
}) {
  const active = activeKey === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-3 py-3 cursor-pointer select-none whitespace-nowrap ${className ?? ''}`}
    >
      <span
        style={{ color: active ? '#2DD4BF' : '#94A3B8' }}
        className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors hover:opacity-80"
      >
        {label}
        <span className="text-[10px] w-3 text-center">
          {active ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ opacity: 0.35 }}>↕</span>}
        </span>
      </span>
    </th>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BookingsClient({
  bookings,
  selectedId,
}: {
  bookings: BookingRow[]
  selectedId?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('confirmed')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('check_in')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Selection state
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [cancelTarget, setCancelTarget] = useState<BookingRow | null>(null)

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    let total = 0
    let confirmed = 0
    let pending = 0
    let cancelled = 0
    let checkinToday = 0
    let checkoutToday = 0
    let outstanding = 0

    for (const b of bookings) {
      total++
      if (b.status === 'confirmed') confirmed++
      if (b.status === 'pending') pending++
      if (b.status === 'cancelled') cancelled++
      if (b.check_in === todayStr) checkinToday++
      if (b.check_out === todayStr && b.check_out !== OPEN_ENDED_DATE) checkoutToday++
      outstanding += Math.max(0, b.total_amount - b.amount_paid)
    }

    return { total, confirmed, pending, cancelled, checkinToday, checkoutToday, outstanding }
  }, [bookings])

  // ── Filtering + sorting ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let rows = bookings

    if (statusFilter !== 'all') {
      rows = rows.filter((b) => b.status === statusFilter)
    }
    if (typeFilter !== 'all') {
      rows = rows.filter((b) => b.booking_type === typeFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (b) =>
          b.guest_first_name.toLowerCase().includes(q) ||
          b.guest_last_name.toLowerCase().includes(q) ||
          b.guest_email.toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q),
      )
    }
    if (fromDate) {
      rows = rows.filter((b) => b.check_in >= fromDate)
    }
    if (toDate) {
      rows = rows.filter((b) => b.check_out <= toDate)
    }

    return rows
  }, [bookings, statusFilter, typeFilter, search, fromDate, toDate])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''

      if (sortKey === 'guest') {
        av = `${a.guest_last_name} ${a.guest_first_name}`.toLowerCase()
        bv = `${b.guest_last_name} ${b.guest_first_name}`.toLowerCase()
      } else if (sortKey === 'room') {
        av = (a.room?.name ?? '').toLowerCase()
        bv = (b.room?.name ?? '').toLowerCase()
      } else if (sortKey === 'total_amount') {
        av = a.total_amount
        bv = b.total_amount
      } else {
        av = ((a[sortKey] as string) ?? '').toLowerCase?.() ?? String(a[sortKey] ?? '')
        bv = ((b[sortKey] as string) ?? '').toLowerCase?.() ?? String(b[sortKey] ?? '')
      }

      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortKey, sortDir])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const hasFilters = !!(statusFilter !== 'all' || typeFilter !== 'all' || search || fromDate || toDate)

  function clearFilters() {
    setStatusFilter('all')
    setTypeFilter('all')
    setSearch('')
    setFromDate('')
    setToDate('')
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
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

  function toggleRow(e: React.ChangeEvent<HTMLInputElement>, id: string) {
    e.stopPropagation()
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      setSelectedRows(new Set(sorted.map((b) => b.id)))
    } else {
      setSelectedRows(new Set())
    }
  }

  async function quickConfirm(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await fetch(`/api/admin/bookings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed' }),
    })
    router.refresh()
  }

  async function bulkConfirm() {
    await Promise.all(
      Array.from(selectedRows).map((id) =>
        fetch(`/api/admin/bookings/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'confirmed' }),
        }),
      ),
    )
    setSelectedRows(new Set())
    router.refresh()
  }

  // ── Pill button style helper ───────────────────────────────────────────────

  const allSelected = sorted.length > 0 && sorted.every((b) => selectedRows.has(b.id))
  const someSelected = sorted.some((b) => selectedRows.has(b.id)) && !allSelected

  return (
    <div className="space-y-4">
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="font-display font-extrabold text-[22px]"
            style={{ color: '#0F172A' }}
          >
            Bookings
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: '#64748B' }}>
            Manage all guest reservations
          </p>
        </div>
        <NewManualBookingButton />
      </div>

      {/* ── Stat pills + today widget ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {(
          [
            { key: 'all', label: 'Total', count: stats.total, color: '#2DD4BF', activeBg: 'rgba(45,212,191,0.08)', activeBorder: 'rgba(45,212,191,0.22)', activeShadow: '0 0 0 3px rgba(45,212,191,0.15)' },
            { key: 'confirmed', label: 'Confirmed', count: stats.confirmed, color: '#059669', activeBg: 'rgba(5,150,105,0.08)', activeBorder: 'rgba(5,150,105,0.2)', activeShadow: '0 0 0 3px rgba(5,150,105,0.12)' },
            { key: 'pending', label: 'Pending', count: stats.pending, color: '#D97706', activeBg: 'rgba(217,119,6,0.08)', activeBorder: 'rgba(217,119,6,0.2)', activeShadow: '0 0 0 3px rgba(217,119,6,0.12)' },
            { key: 'cancelled', label: 'Cancelled', count: stats.cancelled, color: '#DC2626', activeBg: 'rgba(220,38,38,0.07)', activeBorder: 'rgba(220,38,38,0.18)', activeShadow: '0 0 0 3px rgba(220,38,38,0.1)' },
          ] as const
        ).map(({ key, label, count, color, activeBg, activeBorder, activeShadow }) => {
          const active = statusFilter === key
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              style={{
                background: active ? activeBg : '#fff',
                border: `1px solid ${active ? activeBorder : '#E2E8F0'}`,
                boxShadow: active ? activeShadow : 'none',
                borderRadius: '12px',
                padding: '8px 16px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'baseline',
                gap: '6px',
              }}
            >
              <span
                className="font-display text-lg font-extrabold leading-none"
                style={{ color: active ? color : '#0F172A' }}
              >
                {count}
              </span>
              <span
                className="text-[12px] font-semibold"
                style={{ color: active ? color : '#94A3B8' }}
              >
                {label}
              </span>
            </button>
          )
        })}

        {/* Today info widget */}
        <div
          className="ml-auto inline-flex items-center gap-3 text-[12px]"
          style={{
            background: '#fff',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '8px 14px',
            color: '#64748B',
          }}
        >
          <span className="font-semibold" style={{ color: '#0F172A' }}>Today:</span>
          <span>
            <span style={{ color: '#2DD4BF', fontWeight: 700 }}>{stats.checkinToday}</span>
            {' '}in
          </span>
          <span style={{ color: '#E2E8F0' }}>·</span>
          <span>
            <span style={{ color: '#D97706', fontWeight: 700 }}>{stats.checkoutToday}</span>
            {' '}out
          </span>
          <span style={{ color: '#E2E8F0' }}>·</span>
          <span>
            <span style={{ color: '#DC2626', fontWeight: 700 }}>{formatCurrency(stats.outstanding)}</span>
            {' '}outstanding
          </span>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '14px 16px',
        }}
        className="flex flex-wrap items-center gap-3"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94A3B8"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, or booking ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              paddingLeft: '34px',
              paddingRight: '12px',
              paddingTop: '7px',
              paddingBottom: '7px',
              fontSize: '13px',
              color: '#0F172A',
              width: '100%',
              outline: 'none',
            }}
          />
        </div>

        {/* Type toggle */}
        <div
          style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '3px', display: 'inline-flex', gap: '2px' }}
        >
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'short_term', label: 'Short-term' },
              { key: 'long_term', label: 'Long-term' },
            ] as const
          ).map(({ key, label }) => {
            const active = typeFilter === key
            return (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                style={{
                  background: active ? '#fff' : 'transparent',
                  color: active ? '#0F172A' : '#94A3B8',
                  border: active ? '1px solid #E2E8F0' : '1px solid transparent',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>Check-in from</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '13px',
              color: '#0F172A',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>To</span>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '13px',
              color: '#0F172A',
              outline: 'none',
            }}
          />
        </div>

        {/* Clear button */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            style={{
              background: 'rgba(220,38,38,0.06)',
              border: '1px solid rgba(220,38,38,0.15)',
              color: '#DC2626',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear ×
          </button>
        )}
      </div>

      {/* ── Bulk actions bar ─────────────────────────────────────────────────── */}
      {selectedRows.size > 0 && (
        <div
          style={{
            background: '#0F172A',
            borderRadius: '12px',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 600 }}>
            {selectedRows.size} selected
          </span>
          <button
            onClick={bulkConfirm}
            style={{
              background: 'rgba(5,150,105,0.15)',
              border: '1px solid rgba(5,150,105,0.3)',
              color: '#059669',
              borderRadius: '8px',
              padding: '5px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✓ Confirm All
          </button>
          <button
            onClick={() => setSelectedRows(new Set())}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              fontSize: '16px',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '2px 6px',
            }}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Table container ───────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Table header row (above <table>) */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>
            {sorted.length} booking{sorted.length !== 1 ? 's' : ''}
            {statusFilter !== 'all' && (
              <span style={{ color: getStatus(statusFilter).color }}>
                {' '}· {getStatus(statusFilter).label}
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {(
              [
                { key: 'check_in', label: 'Check-in' },
                { key: 'guest', label: 'Guest' },
                { key: 'total_amount', label: 'Amount' },
              ] as { key: SortKey; label: string }[]
            ).map(({ key, label }) => {
              const active = sortKey === key
              return (
                <button
                  key={key}
                  onClick={() => handleSort(key)}
                  style={{
                    background: active ? 'rgba(45,212,191,0.08)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(45,212,191,0.22)' : '#E2E8F0'}`,
                    color: active ? '#2DD4BF' : '#94A3B8',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {label}
                  <span style={{ opacity: active ? 1 : 0.4 }}>
                    {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                {/* Checkbox */}
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    className="cursor-pointer accent-teal-400"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected }}
                    onChange={toggleAll}
                  />
                </th>
                <SortTH label="Guest" sortKey="guest" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTH label="Room" sortKey="room" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTH label="Check-in" sortKey="check_in" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTH label="Check-out" sortKey="check_out" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTH label="Type" sortKey="booking_type" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortTH label="Amount" sortKey="total_amount" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <th className="px-3 py-3 whitespace-nowrap">
                  <span style={{ color: '#94A3B8' }} className="text-[11px] font-bold uppercase tracking-wider">
                    Payment
                  </span>
                </th>
                <SortTH label="Status" sortKey="status" activeKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="px-3 py-3 whitespace-nowrap">
                  <span style={{ color: '#94A3B8' }} className="text-[11px] font-bold uppercase tracking-wider">
                    Source
                  </span>
                </th>
                <th className="px-3 py-3 whitespace-nowrap">
                  <span style={{ color: '#94A3B8' }} className="text-[11px] font-bold uppercase tracking-wider">
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    style={{ padding: '40px 16px', textAlign: 'center', fontSize: '14px', color: '#94A3B8' }}
                  >
                    No bookings match your filters.
                  </td>
                </tr>
              )}
              {sorted.map((b, idx) => {
                const isSelected = selectedRows.has(b.id)
                const isActive = selectedId === b.id
                const statusCfg = getStatus(b.status)
                const srcCfg = getSrc(b.source)
                const initials =
                  (b.guest_first_name?.[0] ?? '') + (b.guest_last_name?.[0] ?? '')

                let rowBg = idx % 2 === 0 ? '#fff' : '#FAFBFD'
                if (isSelected) rowBg = 'rgba(45,212,191,0.04)'
                if (isActive) rowBg = 'rgba(45,212,191,0.06)'

                const checkinIsToday = b.check_in === todayStr
                const checkoutIsToday = b.check_out === todayStr && b.check_out !== OPEN_ENDED_DATE
                const isOpenEnded = b.check_out === OPEN_ENDED_DATE

                return (
                  <tr
                    key={b.id}
                    onClick={() => selectBooking(b.id)}
                    style={{
                      background: rowBg,
                      borderBottom: '1px solid #F8FAFC',
                      height: '56px',
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !isActive) {
                        (e.currentTarget as HTMLTableRowElement).style.background = '#F0FDFA'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !isActive) {
                        (e.currentTarget as HTMLTableRowElement).style.background = rowBg
                      }
                    }}
                  >
                    {/* Checkbox */}
                    <td className="px-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="cursor-pointer accent-teal-400"
                        checked={isSelected}
                        onChange={(e) => toggleRow(e, b.id)}
                      />
                    </td>

                    {/* Guest */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'rgba(45,212,191,0.08)',
                            color: '#1FB2A0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 800,
                            flexShrink: 0,
                            fontFamily: 'var(--font-display, sans-serif)',
                          }}
                        >
                          {initials.toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', lineHeight: 1.2 }}>
                            {b.guest_first_name} {b.guest_last_name}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.2 }}>
                            {b.guest_email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Room */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1FB2A0', lineHeight: 1.2 }}>
                          {b.room?.name ?? '—'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.2 }}>
                          {b.room?.property?.name ?? '—'}
                        </span>
                      </div>
                    </td>

                    {/* Check-in */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: '13px', color: '#0F172A' }}>
                          {formatDate(b.check_in)}
                        </span>
                        {checkinIsToday && (
                          <span
                            style={{
                              background: 'rgba(45,212,191,0.1)',
                              color: '#1FB2A0',
                              border: '1px solid rgba(45,212,191,0.25)',
                              borderRadius: '20px',
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 7px',
                            }}
                          >
                            Today
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Check-out */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isOpenEnded ? (
                        <span style={{ fontSize: '13px', color: '#94A3B8', fontStyle: 'italic' }}>
                          Open-ended
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: '13px', color: '#0F172A' }}>
                            {formatDate(b.check_out)}
                          </span>
                          {checkoutIsToday && (
                            <span
                              style={{
                                background: 'rgba(217,119,6,0.08)',
                                color: '#D97706',
                                border: '1px solid rgba(217,119,6,0.2)',
                                borderRadius: '20px',
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '1px 7px',
                              }}
                            >
                              Today
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        style={{
                          background: '#F1F5F9',
                          color: '#64748B',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 10px',
                        }}
                      >
                        {b.booking_type === 'short_term' ? 'Short-term' : 'Long-term'}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      {(() => {
                        const fee = b.processing_fee ?? 0
                        const net = b.total_amount - fee
                        return (
                          <div className="flex flex-col gap-0.5">
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                              {formatCurrency(net)}
                            </span>
                            {fee > 0 && (
                              <>
                                <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                                  Gross {formatCurrency(b.total_amount)}
                                </span>
                                <span style={{ fontSize: '11px', color: '#DC2626' }}>
                                  −{formatCurrency(fee)} fee
                                </span>
                              </>
                            )}
                          </div>
                        )
                      })()}
                    </td>

                    {/* Payment */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <PayBar paid={b.amount_paid} total={b.total_amount} />
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        style={{
                          background: statusCfg.bg,
                          color: statusCfg.color,
                          border: `1px solid ${statusCfg.border}`,
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {statusCfg.label}
                      </span>
                    </td>

                    {/* Source */}
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span
                        style={{
                          background: srcCfg.bg,
                          color: srcCfg.color,
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 10px',
                        }}
                      >
                        {srcCfg.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td
                      className="px-3 py-2 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5">
                        {/* Quick confirm (pending only) */}
                        {b.status === 'pending' && (
                          <button
                            title="Confirm booking"
                            onClick={(e) => quickConfirm(e, b.id)}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '8px',
                              background: 'rgba(5,150,105,0.08)',
                              border: '1px solid rgba(5,150,105,0.2)',
                              color: '#059669',
                              fontSize: '13px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background 0.12s',
                            }}
                          >
                            ✓
                          </button>
                        )}

                        {/* View */}
                        <button
                          title="View booking"
                          onClick={(e) => { e.stopPropagation(); selectBooking(b.id) }}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            color: '#64748B',
                            fontSize: '14px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 0.12s',
                          }}
                        >
                          →
                        </button>

                        {/* Cancel (not cancelled) */}
                        {b.status !== 'cancelled' && (
                          <button
                            title="Cancel booking"
                            onClick={(e) => { e.stopPropagation(); setCancelTarget(b) }}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '8px',
                              background: 'rgba(220,38,38,0.06)',
                              border: '1px solid rgba(220,38,38,0.15)',
                              color: '#DC2626',
                              fontSize: '13px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'background 0.12s',
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {cancelTarget && (
        <CancelBookingModal
          booking={cancelTarget}
          cancellationPolicy={DEFAULT_POLICY}
          onCancel={() => { setCancelTarget(null); router.refresh() }}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  )
}
