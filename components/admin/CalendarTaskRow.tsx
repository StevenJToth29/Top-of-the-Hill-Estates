'use client'

import { format, differenceInDays } from 'date-fns'
import type { CalendarTask } from '@/types'

interface CalendarTaskRowProps {
  label: string
  tasks: CalendarTask[]
  days: Date[]
  cellWidth: number
  labelColWidth: number
  onTaskClick: (task: CalendarTask) => void
  onAddClick: () => void
}

export function CalendarTaskRow({
  label,
  tasks,
  days,
  cellWidth,
  labelColWidth,
  onTaskClick,
  onAddClick,
}: CalendarTaskRowProps) {
  const firstDay = days[0]
  const lastDay = days[days.length - 1]

  return (
    <tr className="border-b border-slate-100">
      {/* Label cell */}
      <td
        className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 px-2 py-1"
        style={{ width: labelColWidth, minWidth: labelColWidth }}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs text-slate-500 font-medium truncate">{label}</span>
          <button
            onClick={onAddClick}
            className="text-xs text-teal-500 hover:text-teal-700 font-semibold shrink-0"
            title="Add task"
          >
            + Add
          </button>
        </div>
      </td>

      {/* Task grid */}
      <td colSpan={days.length} className="relative p-0" style={{ height: 28 }}>
        <div className="relative w-full h-full">
          {tasks.map((task) => {
            const taskDate = new Date(task.due_date + 'T00:00:00')
            if (taskDate < firstDay || taskDate > lastDay) return null

            const offsetDays = differenceInDays(taskDate, firstDay)
            const left = offsetDays * cellWidth

            return (
              <button
                key={`${task.id}-${task.due_date}`}
                onClick={() => onTaskClick(task)}
                className="absolute top-1 h-5 rounded text-xs text-white font-medium px-1.5 truncate max-w-full hover:opacity-80 transition-opacity"
                style={{
                  left,
                  minWidth: cellWidth - 2,
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
