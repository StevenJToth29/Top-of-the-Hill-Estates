'use client'

import { useState, useMemo, useRef } from 'react'
import { InformationCircleIcon } from '@heroicons/react/16/solid'
import { ModalShell } from './calendar/ModalShell'
import type { Room, CalendarTask } from '@/types'

const PRESET_COLORS = ['#6366F1', '#2DD4BF', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6']
const RECURRENCE_OPTIONS = [
  { label: 'None', value: '' },
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekly', value: 'FREQ=WEEKLY' },
  { label: 'Monthly', value: 'FREQ=MONTHLY' },
  { label: 'Custom Rule', value: 'custom' },
]

interface TaskModalProps {
  rooms: Room[]
  task?: CalendarTask
  initialRoomId?: string | null
  initialPropertyId?: string | null
  initialDate?: string
  occurrenceDate?: string
  onClose: () => void
  onSuccess: (task: CalendarTask) => void
  onDelete?: (taskId: string, occurrenceDate?: string) => void
}

export function TaskModal({
  rooms, task, initialRoomId = null, initialPropertyId = null, initialDate, occurrenceDate, onClose, onSuccess, onDelete,
}: TaskModalProps) {
  const isEdit = !!task
  const isRecurringOccurrence = !!occurrenceDate && !!task?.recurrence_rule

  const properties = useMemo(() => {
    const seen = new Set<string>()
    const list: { id: string; name: string }[] = []
    for (const r of rooms) {
      if (r.property && !seen.has(r.property.id)) {
        seen.add(r.property.id)
        list.push({ id: r.property.id, name: r.property.name })
      }
    }
    return list
  }, [rooms])

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [scope, setScope] = useState<'property' | 'room'>(
    (task?.room_id ?? initialRoomId) ? 'room' : 'property',
  )
  const [roomId, setRoomId] = useState(task?.room_id ?? initialRoomId ?? '')
  const [propertyId, setPropertyId] = useState(
    task?.property_id ?? initialPropertyId ?? properties[0]?.id ?? '',
  )
  const [date, setDate] = useState(task?.due_date ?? initialDate ?? '')
  const [recurrencePreset, setRecurrencePreset] = useState(() => {
    if (!task?.recurrence_rule) return ''
    const preset = RECURRENCE_OPTIONS.find(
      (o) => o.value === task.recurrence_rule && o.value !== 'custom',
    )
    return preset ? preset.value : 'custom'
  })
  const [customRRule, setCustomRRule] = useState(
    recurrencePreset === 'custom' ? (task?.recurrence_rule ?? '') : '',
  )
  const [recurrenceEnd, setRecurrenceEnd] = useState(task?.recurrence_end_date ?? '')
  const [status, setStatus] = useState<'pending' | 'complete'>(task?.status ?? 'pending')
  const [color, setColor] = useState(task?.color ?? PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const rruleIconRef = useRef<HTMLDivElement>(null)
  const [showRruleHelp, setShowRruleHelp] = useState(false)
  const [rruleAnchor, setRruleAnchor] = useState({ top: 0, left: 0 })

  function handleRruleEnter() {
    if (rruleIconRef.current) {
      const r = rruleIconRef.current.getBoundingClientRect()
      setRruleAnchor({ top: r.top, left: r.left + r.width / 2 })
    }
    setShowRruleHelp(true)
  }

  const effectiveRRule = recurrencePreset === 'custom' ? customRRule : recurrencePreset

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return
    setSaving(true)
    setError(null)

    const isOccurrenceEdit = isEdit && !!occurrenceDate
    const payload = isOccurrenceEdit
      ? {
          title: title.trim(),
          description: description.trim() || null,
          status,
          color,
        }
      : {
          title: title.trim(),
          description: description.trim() || null,
          due_date: date,
          room_id: scope === 'room' && roomId ? roomId : null,
          property_id: scope === 'property' && propertyId ? propertyId : null,
          recurrence_rule: effectiveRRule || null,
          recurrence_end_date: recurrenceEnd || null,
          status,
          color,
        }

    try {
      const url = isOccurrenceEdit
        ? `/api/admin/calendar-tasks/${task!.id}/occurrences/${occurrenceDate}`
        : isEdit
          ? `/api/admin/calendar-tasks/${task!.id}`
          : '/api/admin/calendar-tasks'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? `Failed to save task (${res.status})`)
      }
      const j = await res.json()
      if (!j?.task) throw new Error('Server returned an invalid response')
      onSuccess(j.task)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!task || !onDelete) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/calendar-tasks/${task.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed to delete task (${res.status})`)
      }
      onDelete(task.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSaving(false)
    }
  }

  async function handleDeleteOccurrence() {
    if (!task || !onDelete || !occurrenceDate) return
    setSaving(true)
    try {
      const res = await fetch(
        `/api/admin/calendar-tasks/${task.id}/occurrences/${occurrenceDate}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed to delete occurrence (${res.status})`)
      }
      onDelete(task.id, occurrenceDate)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSaving(false)
    }
  }

  async function handleDeleteSeries() {
    if (!task || !onDelete) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/calendar-tasks/${task.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed to delete series (${res.status})`)
      }
      onDelete(task.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSaving(false)
    }
  }

  return (
    <ModalShell title={isEdit ? 'Edit Task' : 'Add Task'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="block text-xs font-medium text-slate-600">Title *</label>
            {isRecurringOccurrence && (
              <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 bg-teal-100 text-teal-700">
                Recurring
              </span>
            )}
          </div>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
        </div>

        {!isRecurringOccurrence && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Scope</label>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
              {[{ v: 'property', label: 'Property-level' }, { v: 'room', label: 'Unit-specific' }].map(({ v, label }) => (
                <button key={v} type="button" onClick={() => setScope(v as 'property' | 'room')}
                  className={`flex-1 py-2 font-medium transition-colors ${
                    scope === v ? 'text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                  style={scope === v ? { background: '#2DD4BF' } : {}}>
                  {label}
                </button>
              ))}
            </div>

            {scope === 'property' && (
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                <option value="">Select a property…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}

            {scope === 'room' && (
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                <option value="">Select a unit…</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.property?.name ? `${r.property.name} — ${r.name}` : r.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {!isRecurringOccurrence && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
          </div>
        )}

        {!isRecurringOccurrence && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label className="text-xs font-medium text-slate-600">Recurrence</label>
              <div
                ref={rruleIconRef}
                onMouseEnter={handleRruleEnter}
                onMouseLeave={() => setShowRruleHelp(false)}
              >
                <InformationCircleIcon className="w-3.5 h-3.5 text-slate-400 cursor-help" />
              </div>
            </div>
            {showRruleHelp && (
              <div
                style={{
                  position: 'fixed',
                  top: rruleAnchor.top,
                  left: rruleAnchor.left,
                  transform: 'translate(-50%, calc(-100% - 8px))',
                  zIndex: 9999,
                }}
                className="w-80 bg-slate-800 text-white text-xs rounded-xl px-3 py-3 shadow-xl pointer-events-none space-y-2"
              >
                <p className="font-semibold text-slate-200 leading-snug">Recurrence options</p>
                <div className="space-y-1.5 text-slate-300">
                  <p><span className="font-medium text-white">None</span> — one-time task, no repeat.</p>
                  <p><span className="font-medium text-white">Daily</span> — repeats every day from the start date.</p>
                  <p><span className="font-medium text-white">Weekly</span> — repeats on the same day of the week.</p>
                  <p><span className="font-medium text-white">Monthly</span> — repeats on the same date each month.</p>
                  <p><span className="font-medium text-white">Custom Rule</span> — enter a raw iCalendar RRULE string.</p>
                </div>
                <div className="border-t border-slate-700 pt-2 space-y-1.5">
                  <p className="font-semibold text-slate-200">RRULE parameters</p>
                  <p className="text-slate-300">
                    <span className="font-mono text-yellow-300">INTERVAL=n</span>
                    <span className="text-slate-400"> — </span>
                    repeat every <em>n</em> periods. <span className="font-mono text-teal-300">INTERVAL=2</span> with <span className="font-mono text-teal-300">FREQ=WEEKLY</span> = every 2 weeks.
                  </p>
                  <p className="text-slate-300">
                    <span className="font-mono text-yellow-300">BYDAY=</span>
                    <span className="text-slate-400"> — </span>
                    day(s) of the week: <span className="font-mono text-teal-300">MO TU WE TH FR SA SU</span>. Prefix with a number for nth-weekday: <span className="font-mono text-teal-300">1MO</span> = 1st Monday, <span className="font-mono text-teal-300">-1FR</span> = last Friday.
                  </p>
                </div>
                <div className="border-t border-slate-700 pt-2">
                  <p className="text-slate-400 text-[10px] mb-1">Examples</p>
                  <ul className="font-mono text-[10px] text-teal-300 space-y-0.5 pl-1">
                    <li>FREQ=WEEKLY;BYDAY=MO,FR</li>
                    <li>FREQ=MONTHLY;BYDAY=1MO</li>
                    <li>FREQ=DAILY;INTERVAL=2</li>
                    <li>FREQ=WEEKLY;INTERVAL=2;BYDAY=SA</li>
                  </ul>
                </div>
                <p className="text-slate-400 text-[10px] leading-snug pt-0.5 border-t border-slate-700">
                  Use <span className="text-white">Ends</span> to set a stop date for any recurring rule.
                </p>
                <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800" aria-hidden />
              </div>
            )}
            <select value={recurrencePreset} onChange={(e) => setRecurrencePreset(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {recurrencePreset === 'custom' && (
              <input type="text" value={customRRule} onChange={(e) => setCustomRRule(e.target.value)}
                placeholder="e.g. FREQ=WEEKLY;BYDAY=MO,FR"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-400" />
            )}
            {recurrencePreset && (
              <div className="mt-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Ends</label>
                <input type="date" value={recurrenceEnd} onChange={(e) => setRecurrenceEnd(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input type="checkbox" id="task-status"
            checked={status === 'complete'}
            onChange={(e) => setStatus(e.target.checked ? 'complete' : 'pending')}
            className="accent-teal-500 w-4 h-4" />
          <label htmlFor="task-status" className="text-sm text-slate-600 cursor-pointer">
            Mark as complete
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Color</label>
          <div className="flex gap-2">
            {PRESET_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'hover:scale-110'}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {confirmDelete ? (
          isRecurringOccurrence ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 space-y-3">
              <p className="text-sm font-semibold text-red-700">Delete recurring task?</p>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDeleteOccurrence}
                  disabled={saving}
                  className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Deleting…' : 'Delete this occurrence'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSeries}
                  disabled={saving}
                  className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Deleting…' : 'Delete the whole series'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 space-y-3">
              <p className="text-sm font-semibold text-red-700">Delete this task?</p>
              <p className="text-xs text-red-500">
                &ldquo;{task?.title}&rdquo; will be permanently removed. This cannot be undone.
              </p>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={handleDelete} disabled={saving}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                  {saving ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="flex justify-between gap-3 pt-2">
            <div>
              {isEdit && onDelete && (
                <button type="button" onClick={() => setConfirmDelete(true)} disabled={saving}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ background: '#2DD4BF' }}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </div>
        )}
      </form>
    </ModalShell>
  )
}
