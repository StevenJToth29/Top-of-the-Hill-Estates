'use client'

import { format } from 'date-fns'

interface OccupancyBarProps {
  days: Date[]
  roomCount: number
  occupancyByDate: Record<string, number>  // date string → occupied room count
  cellWidth: number
  labelColWidth: number
}

export function OccupancyBar({
  days,
  roomCount,
  occupancyByDate,
  cellWidth,
  labelColWidth,
}: OccupancyBarProps) {
  return (
    <div className="flex" style={{ marginLeft: labelColWidth }}>
      {days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const occupied = occupancyByDate[dateStr] ?? 0
        const pct = roomCount > 0 ? occupied / roomCount : 0

        let bg = 'rgba(45,212,191,0.25)'
        if (pct >= 0.8) bg = '#EF4444'
        else if (pct >= 0.5) bg = '#F59E0B'

        const title = `${Math.round(pct * 100)}% occupied`

        return (
          <div
            key={dateStr}
            title={title}
            style={{ width: cellWidth, minWidth: cellWidth, backgroundColor: bg, height: 5 }}
            className="transition-colors"
          />
        )
      })}
    </div>
  )
}
