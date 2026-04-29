'use client'

import { useState } from 'react'
import type { TaskAutomation, Person, Room, Property } from '@/types'
import { TaskAutomationModal } from './TaskAutomationModal'
import { PeopleManager } from './PeopleManager'

const TRIGGER_LABELS: Record<string, string> = {
  booking_confirmed: 'Booking Confirmed',
  checkin_day: 'Check-in Day',
  checkout: 'Checkout',
  booking_cancelled: 'Booking Cancelled',
}

const SCOPE_LABELS: Record<string, string> = {
  global: 'Global',
  property: 'Property',
  room: 'Unit',
}

interface Props {
  initialAutomations: TaskAutomation[]
  people: Person[]
  rooms: Room[]
  properties: Property[]
}

export function TaskAutomationsPage({ initialAutomations, people, rooms, properties }: Props) {
  const [automations, setAutomations] = useState<TaskAutomation[]>(initialAutomations)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskAutomation | undefined>()

  function openNew() { setEditing(undefined); setModalOpen(true) }
  function openEdit(a: TaskAutomation) { setEditing(a); setModalOpen(true) }

  function handleSaved(saved: TaskAutomation) {
    setAutomations((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id)
      return idx >= 0 ? prev.map((a) => a.id === saved.id ? saved : a) : [...prev, saved]
    })
    setModalOpen(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/task-automations/${id}`, { method: 'DELETE' })
    setAutomations((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleToggle(automation: TaskAutomation) {
    const res = await fetch(`/api/admin/task-automations/${automation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !automation.is_active }),
    })
    if (res.ok) {
      const updated: TaskAutomation = await res.json()
      setAutomations((prev) => prev.map((a) => a.id === updated.id ? updated : a))
    }
  }

  const scopeOrder = ['global', 'property', 'room']
  const sorted = [...automations].sort((a, b) => scopeOrder.indexOf(a.scope_type) - scopeOrder.indexOf(b.scope_type))

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-primary">Automation Rules</h2>
          <button className="px-4 py-2 text-sm rounded-lg bg-primary text-white" onClick={openNew}>
            + Add Rule
          </button>
        </div>

        <div className="border rounded-xl overflow-hidden divide-y">
          {sorted.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">No rules yet. Add one above.</p>
          )}
          {sorted.map((auto) => (
            <div key={auto.id} className="flex items-center gap-4 px-4 py-3">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 shrink-0">
                {SCOPE_LABELS[auto.scope_type]}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700 shrink-0">
                {TRIGGER_LABELS[auto.trigger_event]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{auto.title}</p>
                {(auto.room?.name || auto.property?.name) && (
                  <p className="text-xs text-gray-400 truncate">
                    {auto.property?.name}{auto.room?.name ? ` – ${auto.room.name}` : ''}
                  </p>
                )}
              </div>
              <span className="text-xs text-gray-500 shrink-0">
                {auto.day_offset === 0 ? 'Same day' : auto.day_offset > 0 ? `+${auto.day_offset}d` : `${auto.day_offset}d`}
              </span>
              {auto.assignee && (
                <span className="text-xs text-gray-500 shrink-0">{auto.assignee.name}</span>
              )}
              <button
                className={`text-xs font-medium shrink-0 ${auto.is_active ? 'text-green-600' : 'text-gray-400'}`}
                onClick={() => handleToggle(auto)}
              >
                {auto.is_active ? 'Active' : 'Inactive'}
              </button>
              <button className="text-xs text-primary hover:underline shrink-0" onClick={() => openEdit(auto)}>Edit</button>
              <button className="text-xs text-red-500 hover:underline shrink-0" onClick={() => handleDelete(auto.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>

      <PeopleManager initialPeople={people} />

      {modalOpen && (
        <TaskAutomationModal
          automation={editing}
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
