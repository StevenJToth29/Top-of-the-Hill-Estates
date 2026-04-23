'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

const inputBase =
  'bg-surface-highest/40 rounded-xl text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 placeholder-on-surface-variant/50'

export default function PropertiesSearchFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const q = searchParams.get('q') ?? ''
  const filter = searchParams.get('filter') ?? 'all'
  const sort = searchParams.get('sort') ?? 'name_asc'

  const update = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname, searchParams],
  )

  const activeFilters = [q !== '', filter !== 'all', sort !== 'name_asc'].filter(Boolean).length

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'has_units', label: 'Has Units' },
    { value: 'no_units', label: 'No Units' },
  ]

  return (
    <div className="flex flex-wrap gap-2 mb-6 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50 pointer-events-none" />
        <input
          type="text"
          value={q}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="Search properties…"
          className={`${inputBase} w-full pl-9 pr-4 py-2.5`}
        />
        {q && (
          <button
            type="button"
            onClick={() => update({ q: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Units filter toggle */}
      <div className="flex rounded-xl overflow-hidden border border-outline-variant/30 shrink-0">
        {statusOptions.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => update({ filter: value === 'all' ? '' : value })}
            className={`px-3.5 py-2 text-sm font-medium transition-colors ${
              filter === value
                ? value === 'has_units'
                  ? 'bg-secondary/15 text-secondary'
                  : value === 'no_units'
                    ? 'bg-error-container/30 text-error'
                    : 'bg-surface-container text-on-surface'
                : 'bg-surface-highest/40 text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <select
        value={sort}
        onChange={(e) => update({ sort: e.target.value })}
        className={`${inputBase} px-3.5 py-2.5 pr-8 shrink-0 border border-outline-variant/30`}
      >
        <option value="name_asc">Name A → Z</option>
        <option value="name_desc">Name Z → A</option>
        <option value="units_desc">Most Units</option>
        <option value="units_asc">Fewest Units</option>
      </select>

      {/* Clear */}
      {activeFilters > 0 && (
        <button
          type="button"
          onClick={() => update({ q: '', filter: '', sort: '' })}
          className="flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-error transition-colors px-3 py-2.5 rounded-xl hover:bg-error-container/20 shrink-0 border border-outline-variant/30"
        >
          <XMarkIcon className="w-4 h-4" />
          Clear{activeFilters > 1 ? ` (${activeFilters})` : ''}
        </button>
      )}
    </div>
  )
}
