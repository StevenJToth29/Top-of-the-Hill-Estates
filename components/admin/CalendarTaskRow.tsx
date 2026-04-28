'use client'

import { differenceInDays, format } from 'date-fns'
import type { CalendarTask } from '@/types'

interface CalendarTaskRowProps {
  label: string
  tasks: CalendarTask[]
  days: Date[]
  onTaskClick: (task: CalendarTask) => void
  onAddClick: (date: string) => void
  isPropertyRow?: boolean
}

export function CalendarTaskRow({
  label,
  tasks,
  days,
  onTaskClick,
  onAddClick,
  isPropertyRow = false,
}: CalendarTaskRowProps) {
  if (days.length === 0) return null

  const firstDay = days[0]
  const lastDay = days[days.length - 1]

  function handleBackgroundClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const dayIndex = Math.max(0, Math.min(Math.floor((x / rect.width) * days.length), days.length - 1))
    onAddClick(format(days[dayIndex], 'yyyy-MM-dd'))
  }

  const rowBg = isPropertyRow ? '#EEF2FF' : '#F5F3FF'
  const borderColor = isPropertyRow ? '#A5B4FC' : '#C4B5FD'
  const labelColor = isPropertyRow ? '#4338CA' : '#6D28D9'

  return (
    <tr style={{ background: rowBg, borderBottom: `${isPropertyRow ? 2 : 1}px solid ${borderColor}` }}>
      {/* Label cell */}
      <td
        className="sticky left-0 z-10 px-2 py-1"
        style={{
          background: rowBg,
          borderRight: `2px solid ${borderColor}`,
          borderLeft: `3px solid ${isPropertyRow ? '#6366F1' : '#8B5CF6'}`,
        }}
      >
        <span
          className="text-[10px] truncate block"
          style={{ color: labelColor, fontWeight: isPropertyRow ? 700 : 500 }}
        >
          {label}
        </span>
      </td>

      {/* Task grid — click anywhere to add a task at that date */}
      <td colSpan={days.length} className="relative p-0" style={{ height: 30 }}>
        <div
          className="relative w-full h-full cursor-cell group"
          onClick={handleBackgroundClick}
        >
          {/* Hover tint */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none" style={{ background: '#818CF8' }} />

          {tasks.map((task) => {
            const taskDate = new Date(task.due_date + 'T00:00:00')
            if (taskDate < firstDay || taskDate > lastDay) return null

            const offsetDays = differenceInDays(taskDate, firstDay)
            const leftPct = (offsetDays / days.length) * 100
            const minWidthPx = 72
            const naturalWidthPct = (1 / days.length) * 100

            return (
              <button
                type="button"
                key={`${task.id}-${task.due_date}`}
                onClick={(e) => { e.stopPropagation(); onTaskClick(task) }}
                className="absolute top-1 bottom-1 rounded-md text-[10px] text-white font-semibold px-2 truncate hover:brightness-110 transition-all shadow-sm"
                style={{
                  left: `${leftPct}%`,
                  width: `max(${naturalWidthPct}%, ${minWidthPx}px)`,
                  background: task.color ?? '#6366F1',
                  boxShadow: '0 1px 3px rgba(99,102,241,0.4)',
                }}
                title={task.title}
              >
                {task.title}
              </button>
            )
          })}
        </div>
      </td>
    </tr>
  )
}
