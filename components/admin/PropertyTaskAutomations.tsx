'use client'

import { useState } from 'react'
import type { TaskAutomation, Person, Room, Property } from '@/types'
import { TaskAutomationModal } from './TaskAutomationModal'

const TRIGGER_LABELS: Record<string, string> = {
  booking_confirmed: 'Booking Confirmed',
  checkin_day: 'Check-in Day',
  checkout: 'Checkout',
  booking_cancelled: 'Booking Cancelled',
}

interface Props {
  propertyId: string
  initialPropertyRules: TaskAutomation[]
  globalRules: TaskAutomation[]
  people: Person[]
  rooms: Room[]
  properties: Property[]
}

export function PropertyTaskAutomations({
  propertyId, initialPropertyRules, globalRules, people, rooms, properties,
}: Props) {
  const [propRules, setPropRules] = useState<TaskAutomation[]>(initialPropertyRules)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskAutomation | undefined>()

  function openNew() { setEditing(undefined); setModalOpen(true) }
  function openEdit(a: TaskAutomation) { setEditing(a); setModalOpen(true) }

  function handleSaved(saved: TaskAutomation) {
    setPropRules((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id)
      return idx >= 0 ? prev.map((a) => a.id === saved.id ? saved : a) : [...prev, saved]
    })
    setModalOpen(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/task-automations/${id}`, { method: 'DELETE' })
    setPropRules((prev) => prev.filter((a) => a.id !== id))
  }

  const preScoped = {
    id: '', scope_type: 'property' as const, property_id: propertyId, room_id: null,
    trigger_event: 'checkout' as const, title: '', description: null,
    day_offset: 0, color: null, assignee_id: null, is_active: true,
    created_at: '', updated_at: '',
  } satisfies TaskAutomation

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Property Rules</h3>
          <button type="button" className="px-3 py-1.5 text-sm rounded-lg bg-primary text-white" onClick={openNew}>
            + Add Property Rule
          </button>
        </div>
        <div className="border rounded-xl overflow-hidden divide-y">
          {propRules.length === 0 && (
            <p className="px-4 py-4 text-sm text-gray-400">No property-level rules. Using global rules below.</p>
          )}
          {propRules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-4 px-4 py-3">
              <span className="text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-700 shrink-0">
                {TRIGGER_LABELS[rule.trigger_event]}
              </span>
              <span className="flex-1 text-sm font-medium text-gray-800 truncate">{rule.title}</span>
              <span className="text-xs text-gray-400 shrink-0">
                {rule.day_offset === 0 ? 'Same day' : rule.day_offset > 0 ? `+${rule.day_offset}d` : `${rule.day_offset}d`}
              </span>
              <button type="button" className="text-xs text-primary hover:underline shrink-0" onClick={() => openEdit(rule)}>Edit</button>
              <button type="button" className="text-xs text-red-500 hover:underline shrink-0" onClick={() => handleDelete(rule.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      {globalRules.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-500 text-sm">Global Rules (read-only)</h3>
          <div className="border border-dashed rounded-xl overflow-hidden divide-y">
            {globalRules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-4 px-4 py-3 opacity-60">
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">Global</span>
                <span className="text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-700 shrink-0">
                  {TRIGGER_LABELS[rule.trigger_event]}
                </span>
                <span className="flex-1 text-sm text-gray-600 truncate">{rule.title}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {rule.day_offset === 0 ? 'Same day' : rule.day_offset > 0 ? `+${rule.day_offset}d` : `${rule.day_offset}d`}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Adding a property rule for the same trigger will override these global rules for all units in this property.
          </p>
        </div>
      )}

      {modalOpen && (
        <TaskAutomationModal
          automation={editing ?? preScoped}
          rooms={rooms}
          properties={properties}
          people={people}
          onClose={() => setModalOpen(false)}
          onSave={handleSaved}
        />
      )}
    </div>
  )
}
