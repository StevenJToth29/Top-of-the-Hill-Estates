'use client'

import { useState, useCallback, useEffect } from 'react'
import type { DateOverride } from '@/types'

export type OverrideMap = Record<string, Record<string, DateOverride>>

function buildMap(overrides: DateOverride[]): OverrideMap {
  const map: OverrideMap = {}
  for (const o of overrides) {
    if (!map[o.room_id]) map[o.room_id] = {}
    map[o.room_id][o.date] = o
  }
  return map
}

export function useDateOverrides(initial: DateOverride[]) {
  const [overrides, setOverrides] = useState<DateOverride[]>(initial)

  const resetOverrides = useCallback((rows: DateOverride[]) => {
    setOverrides(rows)
  }, [])

  const overrideMap = buildMap(overrides)

  const getOverride = useCallback(
    (roomId: string, date: string): DateOverride | undefined =>
      overrideMap[roomId]?.[date],
    [overrideMap],
  )

  const applyOverrides = useCallback(
    (newRows: DateOverride[]) => {
      setOverrides((prev) => {
        const updated = [...prev]
        for (const row of newRows) {
          const idx = updated.findIndex(
            (o) => o.room_id === row.room_id && o.date === row.date,
          )
          if (idx >= 0) {
            updated[idx] = row
          } else {
            updated.push(row)
          }
        }
        return updated
      })
    },
    [],
  )

  const removeBlock = useCallback(
    (roomId: string, date: string) => {
      setOverrides((prev) =>
        prev.map((o) =>
          o.room_id === roomId && o.date === date
            ? { ...o, is_blocked: false, block_reason: null }
            : o,
        ),
      )
    },
    [],
  )

  const removeOverride = useCallback(
    (roomId: string, date: string) => {
      setOverrides((prev) => prev.filter((o) => !(o.room_id === roomId && o.date === date)))
    },
    [],
  )

  return { overrides, overrideMap, getOverride, applyOverrides, removeBlock, removeOverride, resetOverrides }
}
