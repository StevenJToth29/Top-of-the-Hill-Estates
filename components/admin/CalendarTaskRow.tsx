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

  return (
    <tr className={isPropertyRow ? 'border-b-2 border-slate-400 bg-slate-100' : 'border-b border-slate-300 bg-slate-50'}>
      {/* Label cell */}
      <td className={`sticky left-0 z-10 border-r border-slate-400 px-2 py-1 ${isPropertyRow ? 'bg-slate-100' : 'bg-slate-50'}`}>
        <span className={`text-xs truncate ${isPropertyRow ? 'font-semibold text-slate-700' : 'font-normal text-slate-500'}`}>{label}</span>
      </td>

      {/* Task grid — click anywhere to add a task at that date */}
      <td colSpan={days.length} className="relative p-0" style={{ height: 28 }}>
        <div
          className="relative w-full h-full cursor-cell group"
          onClick={handleBackgroundClick}
        >
          {/* Subtle hover tint */}
          <div className="absolute inset-0 bg-teal-50 opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none rounded" />

          {tasks.map((task) => {
            const taskDate = new Date(task.due_date + 'T00:00:00')
            if (taskDate < firstDay || taskDate > lastDay) return null

            const offsetDays = differenceInDays(taskDate, firstDay)
            const leftPct = (offsetDays / days.length) * 100
            const widthPct = (1 / days.length) * 100

            return (
              <button
                type="button"
                key={`${task.id}-${task.due_date}`}
                onClick={(e) => { e.stopPropagation(); onTaskClick(task) }}
                className="absolute top-1 h-5 rounded text-xs text-white/90 font-light px-1.5 truncate hover:opacity-80 transition-opacity"
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  background: task.color ?? '#6366F1',
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
