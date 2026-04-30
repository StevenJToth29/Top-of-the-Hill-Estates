'use client'

import { useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import type { TaskAutomation, Person } from '@/types'
import { GlobalAutomationModal } from './GlobalAutomationModal'

const TRIGGER_LABELS: Record<string, string> = {
  booking_confirmed: 'Booking Confirmed',
  checkin_day: 'Check-in Day',
  checkout: 'Checkout',
  booking_cancelled: 'Booking Cancelled',
}

const TRIGGER_STYLES: Record<string, string> = {
  booking_confirmed: 'text-secondary bg-secondary/10',
  checkin_day: 'text-blue-400 bg-blue-400/10',
  checkout: 'text-amber-400 bg-amber-400/10',
  booking_cancelled: 'text-error bg-error/10',
}

interface Props {
  initialAutomations: TaskAutomation[]
  people: Person[]
}

export default function GlobalAutomationsClient({ initialAutomations, people }: Props) {
  const [automations, setAutomations] = useState<TaskAutomation[]>(initialAutomations)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<TaskAutomation | undefined>()

  function openNew() { setEditing(undefined); setModalOpen(true) }
  function openEdit(a: TaskAutomation) { setEditing(a); setModalOpen(true) }

  function handleSaved(saved: TaskAutomation) {
    setAutomations(prev => {
      const idx = prev.findIndex(a => a.id === saved.id)
      return idx >= 0 ? prev.map(a => a.id === saved.id ? saved : a) : [...prev, saved]
    })
    setModalOpen(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/task-automations/${id}`, { method: 'DELETE' })
    setAutomations(prev => prev.filter(a => a.id !== id))
  }

  async function handleToggle(automation: TaskAutomation) {
    const res = await fetch(`/api/admin/task-automations/${automation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !automation.is_active }),
    })
    if (res.ok) {
      const updated: TaskAutomation = await res.json()
      setAutomations(prev => prev.map(a => a.id === updated.id ? updated : a))
    }
  }

  const sorted = [...automations].sort((a, b) => a.created_at.localeCompare(b.created_at))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">Automations</h1>
          <p className="text-on-surface-variant mt-1 text-sm">
            Global task rules that apply to every booking across all properties
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-5 py-2.5 hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {/* Rules list */}
      {sorted.length === 0 ? (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-12 text-center space-y-2">
          <p className="text-on-surface-variant">No global automation rules yet.</p>
          <button
            onClick={openNew}
            className="text-secondary hover:underline text-sm"
          >
            Add your first rule
          </button>
        </div>
      ) : (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl border border-outline-variant/20 divide-y divide-outline-variant/10 overflow-hidden">
          {sorted.map(auto => (
            <div
              key={auto.id}
              className="flex items-center gap-4 px-5 py-4 hover:bg-surface-container/30 transition-colors"
            >
              {/* Color swatch */}
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: auto.color ?? '#2DD4BF' }}
              />

              {/* Trigger badge */}
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 ${TRIGGER_STYLES[auto.trigger_event] ?? 'text-on-surface-variant bg-surface-container'}`}
              >
                {TRIGGER_LABELS[auto.trigger_event]}
              </span>

              {/* Title + meta */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">{auto.title}</p>
                {(auto.assignee || auto.description) && (
                  <p className="text-xs text-on-surface-variant/60 truncate mt-0.5">
                    {auto.assignee ? `→ ${auto.assignee.name}` : ''}
                    {auto.assignee && auto.description ? ' · ' : ''}
                    {auto.description ?? ''}
                  </p>
                )}
              </div>

              {/* Day offset */}
              <span className="text-xs text-on-surface-variant shrink-0 tabular-nums">
                {auto.day_offset === 0
                  ? 'Same day'
                  : auto.day_offset > 0
                    ? `+${auto.day_offset}d`
                    : `${auto.day_offset}d`}
              </span>

              {/* Active toggle */}
              <button
                onClick={() => handleToggle(auto)}
                className={`text-xs font-semibold shrink-0 px-2.5 py-1 rounded-lg transition-colors ${
                  auto.is_active
                    ? 'text-secondary bg-secondary/10 hover:bg-secondary/20'
                    : 'text-on-surface-variant/50 bg-surface-container hover:bg-surface-high'
                }`}
              >
                {auto.is_active ? 'Active' : 'Inactive'}
              </button>

              <button
                onClick={() => openEdit(auto)}
                className="text-xs font-medium text-on-surface-variant hover:text-secondary transition-colors shrink-0"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(auto.id)}
                className="text-xs font-medium text-on-surface-variant hover:text-error transition-colors shrink-0"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <GlobalAutomationModal
          automation={editing}
          people={people}
          onClose={() => setModalOpen(false)}
          onSave={handleSaved}
        />
      )}
    </div>
  )
}
