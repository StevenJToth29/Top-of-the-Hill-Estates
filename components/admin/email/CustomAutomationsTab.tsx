'use client'

import { useState } from 'react'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import ConditionBuilder from './ConditionBuilder'
import type {
  ConditionBlock,
  EmailAutomation,
  EmailTemplate,
  RecipientType,
  TriggerEvent,
} from '@/types'
import { TRIGGER_EVENT_LABELS } from '@/lib/email-variables'

type DelayUnit = 'minutes' | 'hours' | 'days'
type DelayDir = 'before' | 'after'

interface FormState {
  name: string
  trigger_event: TriggerEvent
  is_active: boolean
  delayValue: number
  delayUnit: DelayUnit
  delayDir: DelayDir
  conditions: ConditionBlock
  template_id: string
  recipient_type: RecipientType
}

function emptyForm(): FormState {
  return {
    name: '',
    trigger_event: 'booking_confirmed',
    is_active: true,
    delayValue: 0,
    delayUnit: 'minutes',
    delayDir: 'after',
    conditions: { operator: 'AND', rules: [] },
    template_id: '',
    recipient_type: 'guest',
  }
}

function automationToForm(a: EmailAutomation): FormState {
  const abs = Math.abs(a.delay_minutes)
  const delayDir: DelayDir = a.delay_minutes < 0 ? 'before' : 'after'
  let delayValue = abs
  let delayUnit: DelayUnit = 'minutes'
  if (abs % 1440 === 0 && abs > 0) {
    delayValue = abs / 1440
    delayUnit = 'days'
  } else if (abs % 60 === 0 && abs > 0) {
    delayValue = abs / 60
    delayUnit = 'hours'
  }
  return {
    name: a.name,
    trigger_event: a.trigger_event,
    is_active: a.is_active,
    delayValue,
    delayUnit,
    delayDir,
    conditions: a.conditions ?? { operator: 'AND', rules: [] },
    template_id: a.template_id ?? '',
    recipient_type: a.recipient_type,
  }
}

function encodeDelay(value: number, unit: DelayUnit, dir: DelayDir): number {
  const m = unit === 'hours' ? value * 60 : unit === 'days' ? value * 1440 : value
  return dir === 'before' ? -m : m
}

interface Props {
  automations: EmailAutomation[]
  templates: EmailTemplate[]
}

export default function CustomAutomationsTab({ automations: initial, templates }: Props) {
  const [automations, setAutomations] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  function openNew() {
    setForm(emptyForm())
    setEditingId(null)
    setShowForm(true)
    setError(null)
  }

  function openEdit(a: EmailAutomation) {
    setForm(automationToForm(a))
    setEditingId(a.id)
    setShowForm(true)
    setError(null)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name,
      trigger_event: form.trigger_event,
      is_active: form.is_active,
      delay_minutes: encodeDelay(form.delayValue, form.delayUnit, form.delayDir),
      conditions: form.conditions,
      template_id: form.template_id || null,
      recipient_type: form.recipient_type,
    }
    try {
      const url = editingId
        ? `/api/admin/email/automations/${editingId}`
        : '/api/admin/email/automations'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json()
        setError((json as { error?: string }).error ?? 'Failed to save')
        return
      }
      const saved = (await res.json()) as EmailAutomation
      if (editingId) {
        setAutomations((prev) => prev.map((a) => (a.id === editingId ? saved : a)))
      } else {
        setAutomations((prev) => [...prev, saved])
      }
      setShowForm(false)
      setEditingId(null)
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this automation?')) return
    setDeleting(id)
    const res = await fetch(`/api/admin/email/automations/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setAutomations((prev) => prev.filter((a) => a.id !== id))
    }
    setDeleting(null)
  }

  const inputClass =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50'
  const labelClass = 'text-on-surface-variant text-sm mb-1 block'
  const selectClass =
    'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50'

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          aria-label="New Automation"
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-background"
        >
          <PlusIcon className="h-4 w-4" />
          New Automation
        </button>
      </div>

      {!automations.length && !showForm && (
        <p className="text-on-surface-variant text-sm">
          No custom automations yet. Create one above.
        </p>
      )}

      {automations.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-3 bg-surface-highest/40 rounded-xl px-4 py-3"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-on-surface text-sm">{a.name}</p>
            <p className="text-xs text-on-surface-variant">
              {TRIGGER_EVENT_LABELS[a.trigger_event] ?? a.trigger_event}
            </p>
          </div>
          <span
            className={[
              'text-xs rounded-full px-2 py-0.5',
              a.is_active
                ? 'bg-primary/15 text-primary'
                : 'bg-surface-high text-on-surface-variant',
            ].join(' ')}
          >
            {a.is_active ? 'Active' : 'Off'}
          </span>
          <button
            type="button"
            onClick={() => openEdit(a)}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-high hover:text-on-surface transition-colors"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleDelete(a.id)}
            disabled={deleting === a.id}
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-high hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}

      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-surface-highest/40 rounded-2xl p-6 space-y-5"
        >
          <h3 className="font-semibold text-on-surface">
            {editingId ? 'Edit Automation' : 'New Automation'}
          </h3>

          <div>
            <label className={labelClass} htmlFor="auto-trigger">
              Trigger Event
            </label>
            <select
              id="auto-trigger"
              value={form.trigger_event}
              onChange={(e) =>
                setForm((f) => ({ ...f, trigger_event: e.target.value as TriggerEvent }))
              }
              className={selectClass}
            >
              {Object.entries(TRIGGER_EVENT_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Conditions (optional)</label>
            <ConditionBuilder
              value={form.conditions}
              onChange={(c) => setForm((f) => ({ ...f, conditions: c }))}
            />
          </div>

          <div>
            <label className={labelClass}>Delay</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                min={0}
                value={form.delayValue}
                onChange={(e) =>
                  setForm((f) => ({ ...f, delayValue: Number(e.target.value) }))
                }
                className="w-20 bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
              />
              <select
                value={form.delayUnit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, delayUnit: e.target.value as DelayUnit }))
                }
                className="bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
              >
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
              {form.delayValue > 0 && (
                <select
                  value={form.delayDir}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, delayDir: e.target.value as DelayDir }))
                  }
                  className="bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
                >
                  <option value="after">after event</option>
                  <option value="before">before event</option>
                </select>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="auto-template">
              Template
            </label>
            <select
              id="auto-template"
              value={form.template_id}
              onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
              className={selectClass}
            >
              <option value="">No template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="auto-recipient">
              Send To
            </label>
            <select
              id="auto-recipient"
              value={form.recipient_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, recipient_type: e.target.value as RecipientType }))
              }
              className={selectClass}
            >
              <option value="guest">Guest</option>
              <option value="admin">Admin</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="auto-name">
              Automation Name
            </label>
            <input
              id="auto-name"
              aria-label="Automation name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
              placeholder="e.g. Long-stay follow-up"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={form.is_active}
              onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
              className={[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                form.is_active ? 'bg-primary' : 'bg-surface-high',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block h-4 w-4 transform rounded-full bg-background transition-transform',
                  form.is_active ? 'translate-x-6' : 'translate-x-1',
                ].join(' ')}
              />
            </button>
            <span className="text-sm text-on-surface-variant">
              {form.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              aria-label="Save Automation"
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Automation'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="rounded-xl bg-surface-high px-6 py-2.5 text-sm font-semibold text-on-surface"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
