'use client'

import { useState } from 'react'
import { ModalShell } from './calendar/ModalShell'
import type { Room, CalendarTask } from '@/types'

const PRESET_COLORS = ['#6366F1', '#2DD4BF', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6']
const RECURRENCE_OPTIONS = [
  { label: 'None', value: '' },
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekly', value: 'FREQ=WEEKLY' },
  { label: 'Monthly', value: 'FREQ=MONTHLY' },
  { label: 'Custom (RRULE)', value: 'custom' },
]

interface TaskModalProps {
  rooms: Room[]
  task?: CalendarTask
  initialRoomId?: string | null
  initialDate?: string
  onClose: () => void
  onSuccess: (task: CalendarTask) => void
  onDelete?: (taskId: string) => void
}

export function TaskModal({
  rooms, task, initialRoomId = null, initialDate, onClose, onSuccess, onDelete,
}: TaskModalProps) {
  const isEdit = !!task

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [scope, setScope] = useState<'property' | 'room'>(
    (task?.room_id ?? initialRoomId) ? 'room' : 'property',
  )
  const [roomId, setRoomId] = useState(task?.room_id ?? initialRoomId ?? '')
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

  const effectiveRRule = recurrencePreset === 'custom' ? customRRule : recurrencePreset

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !date) return
    setSaving(true)
    setError(null)

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      due_date: date,
      room_id: scope === 'room' && roomId ? roomId : null,
      recurrence_rule: effectiveRRule || null,
      recurrence_end_date: recurrenceEnd || null,
      status,
      color,
    }

    try {
      const url = isEdit ? `/api/admin/calendar-tasks/${task!.id}` : '/api/admin/calendar-tasks'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Failed to save task')
      }
      const j = await res.json()
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
    if (!confirm(`Delete task "${task.title}"?`)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/calendar-tasks/${task.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete task')
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
          <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Scope</label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
            {[{ v: 'property', label: 'Property-wide' }, { v: 'room', label: 'Room-specific' }].map(({ v, label }) => (
              <button key={v} type="button" onClick={() => setScope(v as 'property' | 'room')}
                className={`flex-1 py-2 font-medium transition-colors ${
                  scope === v ? 'text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
                style={scope === v ? { background: '#2DD4BF' } : {}}>
                {label}
              </button>
            ))}
          </div>
          {scope === 'room' && (
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option value="">Select a room…</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Recurrence</label>
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

        <div className="flex justify-between gap-3 pt-2">
          <div>
            {isEdit && onDelete && (
              <button type="button" onClick={handleDelete} disabled={saving}
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
      </form>
    </ModalShell>
  )
}
