import { RRule } from 'rrule'
import type { CalendarTask, TaskException } from '@/types'

export function expandRecurringTasks(
  tasks: CalendarTask[],
  exceptions: TaskException[],
  from: Date,
  to: Date,
): CalendarTask[] {
  const exceptionMap = new Map<string, TaskException>()
  for (const exc of exceptions) {
    exceptionMap.set(`${exc.task_id}|${exc.occurrence_date}`, exc)
  }

  const result: CalendarTask[] = []

  for (const task of tasks) {
    if (!task.recurrence_rule) {
      result.push(task)
      continue
    }

    try {
      const dtstart = new Date(task.due_date + 'T00:00:00Z')
      const rruleOptions = RRule.parseString(task.recurrence_rule)
      rruleOptions.dtstart = dtstart
      if (task.recurrence_end_date) {
        rruleOptions.until = new Date(task.recurrence_end_date + 'T23:59:59Z')
      }

      const rule = new RRule(rruleOptions)
      const occurrences = rule.between(from, to, true)
      const MAX_OCCURRENCES = 500

      for (const occ of occurrences.slice(0, MAX_OCCURRENCES)) {
        const dateStr = occ.toISOString().split('T')[0]
        const key = `${task.id}|${dateStr}`
        const exc = exceptionMap.get(key)

        if (exc?.is_deleted) continue

        result.push({
          ...task,
          due_date: dateStr,
          occurrence_date: dateStr,
          is_recurring: true,
          status: (exc?.status ?? task.status) as 'pending' | 'complete',
          title: exc?.title ?? task.title,
          color: exc?.color ?? task.color,
          description: exc?.description ?? task.description,
        })
      }
    } catch {
      result.push(task)
    }
  }

  return result
}
