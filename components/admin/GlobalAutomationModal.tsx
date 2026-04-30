'use client'

import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { TaskAutomation, TaskTriggerEvent, Person } from '@/types'

const PRESET_COLORS = ['#6366F1', '#2DD4BF', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6']

const TRIGGER_LABELS: Record<TaskTriggerEvent, string> = {
  booking_confirmed: 'Booking Confirmed',
  checkin_day: 'Check-in Day',
  checkout: 'Checkout',
  booking_cancelled: 'Booking Cancelled',
}

interface Props {
  automation?: TaskAutomation
  people: Person[]
  onClose: () => void
  onSave: (automation: TaskAutomation) => void
}

export function GlobalAutomationModal({ automation, people, onClose, onSave }: Props) {
  const isEdit = !!automation?.id
  const [trigger, setTrigger] = useState<TaskTriggerEvent>(automation?.trigger_event ?? 'checkout')
  const [title, setTitle] = useState(automation?.title ?? '')
  const [description, setDescription] = useState(automation?.description ?? '')
  const [dayOffset, setDayOffset] = useState(automation?.day_offset ?? 0)
  const [assigneeId, setAssigneeId] = useState(automation?.assignee_id ?? '')
  const [color, setColor] = useState(automation?.color ?? PRESET_COLORS[1])
  const [isActive, setIsActive] = useState(automation?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError(null)
    try {
      const body = {
        scope_type: 'global',
        trigger_event: trigger,
        title: title.trim(),
        description: description.trim() || null,
        day_offset: dayOffset,
        room_id: null,
        property_id: null,
        assignee_id: assigneeId || null,
        color: color || null,
        is_active: isActive,
      }
      const url = isEdit
        ? `/api/admin/task-automations/${automation!.id}`
        : '/api/admin/task-automations'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Save failed') }
      onSave(await res.json())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 border border-outline-variant/20'
  const labelClass =
    'block text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-2xl border border-outline-variant/20 shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/15">
          <h2 className="font-display text-lg font-bold text-on-surface">
            {isEdit ? 'Edit Automation' : 'New Global Automation'}
          </h2>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelClass}>Trigger Event</label>
            <select
              className={inputClass}
              value={trigger}
              onChange={e => setTrigger(e.target.value as TaskTriggerEvent)}
            >
              {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Task Title</label>
            <input
              className={inputClass}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Post-checkout cleaning"
            />
          </div>

          <div>
            <label className={labelClass}>
              Description{' '}
              <span className="normal-case font-normal text-on-surface-variant/50">optional</span>
            </label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className={labelClass}>Day Offset</label>
            <p className="text-xs text-on-surface-variant/60 mb-1.5">
              0 = event day · −1 = day before · +1 = day after
            </p>
            <input
              type="number"
              className={inputClass}
              value={dayOffset}
              onChange={e => setDayOffset(parseInt(e.target.value, 10) || 0)}
            />
          </div>

          <div>
            <label className={labelClass}>
              Assign To{' '}
              <span className="normal-case font-normal text-on-surface-variant/50">optional</span>
            </label>
            <select
              className={inputClass}
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Color</label>
            <div className="flex gap-2.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-surface ring-white/30' : 'hover:scale-110'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-on-surface cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-teal-400"
            />
            Active
          </label>

          {error && (
            <p className="text-sm text-error bg-error-container/20 rounded-xl px-4 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-outline-variant/15">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface rounded-xl border border-outline-variant/30 hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-primary to-secondary text-background rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  )
}
