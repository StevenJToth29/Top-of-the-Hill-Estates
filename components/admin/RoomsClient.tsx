'use client'

import { useState, useEffect, useLayoutEffect, useMemo } from 'react'

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

const PAGE_SIZE = 10
import Link from 'next/link'
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import RoomCardWithIcal from '@/app/admin/(protected)/rooms/RoomCardWithIcal'
import SyncAllButton from '@/components/admin/SyncAllButton'
import type { Room, Property, ICalSource } from '@/types'

type RoomWithIcal = Room & { property: Property; ical_sources: ICalSource[] }
type PropertySummary = Pick<Property, 'id' | 'name' | 'city' | 'state'>
type PageSegment = { property: PropertySummary; rooms: RoomWithIcal[] }

interface Filters {
  search: string
  status: 'all' | 'active' | 'inactive'
  propertyId: string
  sort: 'name_asc' | 'name_desc' | 'rate_asc' | 'rate_desc'
}

const DEFAULT_FILTERS: Filters = {
  search: '',
  status: 'all',
  propertyId: 'all',
  sort: 'name_asc',
}

const STORAGE_KEY = 'admin-rooms-filters'

interface Props {
  rooms: RoomWithIcal[]
  properties: PropertySummary[]
  siteUrl: string
}

function isDefault(f: Filters) {
  return (
    f.search === '' &&
    f.status === 'all' &&
    f.propertyId === 'all' &&
    f.sort === 'name_asc'
  )
}

export default function RoomsClient({ rooms, properties, siteUrl }: Props) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [hydrated, setHydrated] = useState(false)

  useIsomorphicLayoutEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const stored = JSON.parse(raw)
        // Never restore the propertyId filter — it hides entire property sections
        // and is easy to miss after navigating away and back.
        setFilters({ ...DEFAULT_FILTERS, ...stored, propertyId: 'all' })
      }
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    // Don't persist propertyId — see above comment.
    const { propertyId: _pid, ...persistable } = filters
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistable))
  }, [filters, hydrated])

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  const filtered = useMemo(() => {
    let result = rooms
    const q = filters.search.toLowerCase().trim()
    if (q) result = result.filter((r) => r.name.toLowerCase().includes(q) || r.short_description?.toLowerCase().includes(q))
    if (filters.status !== 'all') result = result.filter((r) => (filters.status === 'active') === r.is_active)
    if (filters.propertyId !== 'all') result = result.filter((r) => r.property_id === filters.propertyId)
    return [...result].sort((a, b) => {
      if (filters.sort === 'name_desc') return b.name.localeCompare(a.name)
      if (filters.sort === 'rate_asc') return a.nightly_rate - b.nightly_rate
      if (filters.sort === 'rate_desc') return b.nightly_rate - a.nightly_rate
      return a.name.localeCompare(b.name)
    })
  }, [rooms, filters])

  const grouped = useMemo(
    () =>
      filtered.reduce<Record<string, { property: Property; rooms: RoomWithIcal[] }>>((acc, room) => {
        const pid = room.property_id
        if (!acc[pid]) acc[pid] = { property: room.property, rooms: [] }
        acc[pid].rooms.push(room)
        return acc
      }, {}),
    [filtered],
  )

  // Count of all rooms per property regardless of filters — used to tell apart
  // "this property is empty" from "rooms exist but are hidden by the current filter."
  const totalByProperty = useMemo(
    () => rooms.reduce<Record<string, number>>((acc, r) => { acc[r.property_id] = (acc[r.property_id] ?? 0) + 1; return acc }, {}),
    [rooms],
  )

  const filteredProperties = useMemo(
    () => properties.filter((p) => filters.propertyId === 'all' || filters.propertyId === p.id),
    [properties, filters.propertyId],
  )

  // Pack rooms into pages of PAGE_SIZE. Properties may be split across pages;
  // the property header is repeated on each page where its rooms appear.
  // Properties with no visible rooms (filtered out or truly empty) are still
  // included in the page they fall into so the user sees contextual messages.
  const propertyPageGroups = useMemo<PageSegment[][]>(() => {
    const pages: PageSegment[][] = []
    let currentPage: PageSegment[] = []
    let currentCount = 0

    for (const p of filteredProperties) {
      const propRooms = grouped[p.id]?.rooms ?? []

      if (propRooms.length === 0) {
        // Keep the property visible (shows "hidden" or "no units" message) without
        // consuming a room slot — flush the page first if already full.
        if (currentCount >= PAGE_SIZE && currentPage.length > 0) {
          pages.push(currentPage)
          currentPage = []
          currentCount = 0
        }
        currentPage.push({ property: p, rooms: [] })
        continue
      }

      let remaining = [...propRooms]
      while (remaining.length > 0) {
        if (currentCount === PAGE_SIZE) {
          pages.push(currentPage)
          currentPage = []
          currentCount = 0
        }
        const chunk = remaining.splice(0, PAGE_SIZE - currentCount)
        currentPage.push({ property: p, rooms: chunk })
        currentCount += chunk.length
      }
    }

    if (currentPage.length > 0) pages.push(currentPage)
    return pages
  }, [filteredProperties, grouped])

  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [filtered])

  const totalPages = propertyPageGroups.length

  const pagedSegments = propertyPageGroups[page - 1] ?? []

  const hasProperties = properties.length > 0
  const activeFilters = [
    filters.search !== '',
    filters.status !== 'all',
    filters.propertyId !== 'all',
    filters.sort !== 'name_asc',
  ].filter(Boolean).length

  const inputBase =
    'bg-surface-highest/40 rounded-xl text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 placeholder-on-surface-variant/50'

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">Units</h1>
          <p className="text-on-surface-variant mt-1">
            {filtered.length !== rooms.length
              ? `${filtered.length} of ${rooms.length} unit${rooms.length !== 1 ? 's' : ''}`
              : `${rooms.length} unit${rooms.length !== 1 ? 's' : ''}`}{' '}
            across {filteredProperties.length} propert{filteredProperties.length === 1 ? 'y' : 'ies'}
            {totalPages > 1 && (
              <span className="text-on-surface-variant/50"> · page {page} of {totalPages}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SyncAllButton />
          {hasProperties ? (
            <Link
              href="/admin/rooms/new"
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-5 py-2.5 hover:opacity-90 transition-opacity"
            >
              <PlusIcon className="w-4 h-4" />
              Add New Unit
            </Link>
          ) : (
            <span
              title="Create a property first before adding units."
              className="flex items-center gap-2 bg-surface-container text-on-surface-variant font-semibold rounded-2xl px-5 py-2.5 cursor-not-allowed opacity-50 select-none"
            >
              <PlusIcon className="w-4 h-4" />
              Add New Unit
            </span>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="Search units…"
            className={`${inputBase} w-full pl-9 pr-4 py-2.5`}
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => set('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status */}
        <div className="flex rounded-xl overflow-hidden border border-outline-variant/30 shrink-0">
          {(['all', 'active', 'inactive'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => set('status', v)}
              className={`px-3.5 py-2 text-sm font-medium transition-colors capitalize ${
                filters.status === v
                  ? v === 'active'
                    ? 'bg-secondary/15 text-secondary'
                    : v === 'inactive'
                      ? 'bg-error-container/30 text-error'
                      : 'bg-surface-container text-on-surface'
                  : 'bg-surface-highest/40 text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {v === 'all' ? 'All' : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Property */}
        {properties.length > 1 && (
          <select
            value={filters.propertyId}
            onChange={(e) => set('propertyId', e.target.value)}
            className={`${inputBase} px-3.5 py-2.5 pr-8 shrink-0 border border-outline-variant/30`}
          >
            <option value="all">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {/* Sort */}
        <select
          value={filters.sort}
          onChange={(e) => set('sort', e.target.value as Filters['sort'])}
          className={`${inputBase} px-3.5 py-2.5 pr-8 shrink-0 border border-outline-variant/30`}
        >
          <option value="name_asc">Name A → Z</option>
          <option value="name_desc">Name Z → A</option>
          <option value="rate_asc">Rate: Low → High</option>
          <option value="rate_desc">Rate: High → Low</option>
        </select>

        {/* Clear */}
        {activeFilters > 0 && (
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-error transition-colors px-3 py-2.5 rounded-xl hover:bg-error-container/20 shrink-0 border border-outline-variant/30"
          >
            <XMarkIcon className="w-4 h-4" />
            Clear{activeFilters > 1 ? ` (${activeFilters})` : ''}
          </button>
        )}
      </div>

      {/* Room list */}
      {rooms.length === 0 ? (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-12 text-center space-y-2">
          <p className="text-on-surface-variant">No units yet.</p>
          {hasProperties ? (
            <Link href="/admin/rooms/new" className="inline-block text-secondary hover:underline text-sm">
              Add your first unit
            </Link>
          ) : (
            <p className="text-sm text-on-surface-variant/60">
              You need to{' '}
              <Link href="/admin/properties/new" className="text-secondary hover:underline">
                create a property
              </Link>{' '}
              first before adding units.
            </p>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-12 text-center space-y-2">
          <p className="text-on-surface-variant">No units match your filters.</p>
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="inline-block text-secondary hover:underline text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-8">
            {pagedSegments.map((segment, idx) => {
              const { property: p, rooms: propRooms } = segment
              return (
                <div key={`${p.id}-${idx}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div>
                      <h2 className="font-display text-base font-bold text-on-surface">{p.name}</h2>
                      <p className="text-xs text-on-surface-variant/60">
                        {p.city}, {p.state}
                      </p>
                    </div>
                    <div className="flex-1 h-px bg-outline-variant/30" />
                    <Link
                      href={`/admin/rooms/new?property_id=${p.id}`}
                      className="flex items-center gap-1.5 text-xs font-semibold text-secondary border border-dashed border-secondary/40 rounded-xl px-3 py-1.5 hover:bg-secondary/5 transition-colors"
                    >
                      + Add Unit
                    </Link>
                  </div>
                  {propRooms.length > 0 ? (
                    <div className="space-y-3">
                      {propRooms.map((room) => (
                        <RoomCardWithIcal key={room.id} room={room} siteUrl={siteUrl} />
                      ))}
                    </div>
                  ) : totalByProperty[p.id] ? (
                    <p className="text-sm text-on-surface-variant/50 pl-1">
                      {totalByProperty[p.id]} unit{totalByProperty[p.id] !== 1 ? 's' : ''} hidden by active filters.{' '}
                      <button
                        type="button"
                        onClick={() => setFilters(DEFAULT_FILTERS)}
                        className="text-secondary hover:underline"
                      >
                        Clear filters
                      </button>
                    </p>
                  ) : (
                    <p className="text-sm text-on-surface-variant/50 pl-1">No units yet.</p>
                  )}
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 flex-wrap">
              {/* First / Prev */}
              {(['«', '‹'] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setPage(label === '«' ? 1 : (p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`px-2.5 py-1.5 text-sm font-bold rounded-lg border transition-colors ${page === 1 ? 'border-outline-variant/20 text-on-surface-variant/25 cursor-default' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container cursor-pointer'}`}
                >
                  {label}
                </button>
              ))}

              {/* Page select */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-on-surface-variant">Page</span>
                <select
                  value={page}
                  onChange={(e) => setPage(Number(e.target.value))}
                  className="py-1.5 px-2 text-sm font-semibold rounded-lg border border-outline-variant/30 bg-surface-highest/40 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 cursor-pointer"
                >
                  {Array.from({ length: totalPages }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
                <span className="text-xs text-on-surface-variant/50">of {totalPages}</span>
              </div>

              {/* Go-to number input */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-on-surface-variant">Go to</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  placeholder="–"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = Number((e.target as HTMLInputElement).value)
                      if (v >= 1 && v <= totalPages) { setPage(v); (e.target as HTMLInputElement).value = '' }
                    }
                  }}
                  className="w-14 py-1.5 px-2 text-sm font-semibold text-center rounded-lg border border-outline-variant/30 bg-surface-highest/40 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
                />
              </div>

              {/* Next / Last */}
              {(['›', '»'] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setPage(label === '»' ? totalPages : (p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`px-2.5 py-1.5 text-sm font-bold rounded-lg border transition-colors ${page === totalPages ? 'border-outline-variant/20 text-on-surface-variant/25 cursor-default' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container cursor-pointer'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
