'use client'

import { useState } from 'react'
import type { TaskAutomation, TaskTriggerEvent, TaskScopeType, Person, Room, Property } from '@/types'

const TRIGGER_LABELS: Record<TaskTriggerEvent, string> = {
  booking_confirmed: 'Booking Confirmed',
  checkin_day: 'Check-in Day',
  checkout: 'Checkout',
  booking_cancelled: 'Booking Cancelled',
}

interface Props {
  automation?: TaskAutomation
  rooms: Room[]
  properties: Property[]
  people: Person[]
  onClose: () => void
  onSave: (automation: TaskAutomation) => void
}

export function TaskAutomationModal({ automation, rooms, properties, people, onClose, onSave }: Props) {
  const isEdit = !!automation?.id
  const [scope, setScope] = useState<TaskScopeType>(automation?.scope_type ?? 'global')
  const [trigger, setTrigger] = useState<TaskTriggerEvent>(automation?.trigger_event ?? 'checkout')
  const [roomId, setRoomId] = useState(automation?.room_id ?? '')
  const [propertyId, setPropertyId] = useState(automation?.property_id ?? '')
  const [title, setTitle] = useState(automation?.title ?? '')
  const [description, setDescription] = useState(automation?.description ?? '')
  const [dayOffset, setDayOffset] = useState(automation?.day_offset ?? 0)
  const [assigneeId, setAssigneeId] = useState(automation?.assignee_id ?? '')
  const [isActive, setIsActive] = useState(automation?.is_active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return }
    if (scope === 'room' && !roomId) { setError('Select a room'); return }
    if (scope === 'property' && !propertyId) { setError('Select a property'); return }
    setSaving(true)
    setError(null)
    try {
      const body = {
        scope_type: scope, trigger_event: trigger, title: title.trim(),
        description: description.trim() || null,
        day_offset: dayOffset,
        room_id: scope === 'room' ? roomId : null,
        property_id: scope === 'property' ? propertyId : null,
        assignee_id: assigneeId || null,
        is_active: isActive,
      }
      const url = isEdit ? `/api/admin/task-automations/${automation!.id}` : '/api/admin/task-automations'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Save failed'); }
      const saved = await res.json()
      onSave(saved)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-display text-xl text-primary">{isEdit ? 'Edit Rule' : 'New Automation Rule'}</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={scope}
              onChange={(e) => setScope(e.target.value as TaskScopeType)}>
              <option value="global">Global (all units)</option>
              <option value="property">Property</option>
              <option value="room">Unit</option>
            </select>
          </div>

          {scope === 'property' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">Select property…</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}

          {scope === 'room' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={roomId}
                onChange={(e) => setRoomId(e.target.value)}>
                <option value="">Select unit…</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.property?.name} – {r.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Event</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={trigger}
              onChange={(e) => setTrigger(e.target.value as TaskTriggerEvent)}>
              {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Title</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={title}
              onChange={(e) => setTitle(e.target.value)} placeholder="Post-checkout cleaning" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} value={description}
              onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Day Offset <span className="text-gray-400 font-normal">(0 = event day, −1 = day before, +1 = day after)</span>
            </label>
            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={dayOffset}
              onChange={(e) => setDayOffset(parseInt(e.target.value, 10) || 0)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign To (optional)</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button className="px-4 py-2 text-sm rounded-lg border" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="px-4 py-2 text-sm rounded-lg bg-primary text-white disabled:opacity-50"
            onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  )
}
