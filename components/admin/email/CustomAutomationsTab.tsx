'use client'

import { useState } from 'react'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
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
      conditions: { operator: 'AND', rules: [] },
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
    'w-full bg-slate-50 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 transition-colors'
  const selectClass =
    'w-full bg-slate-50 rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 transition-colors'
  const labelClass = 'block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5'

  return (
    <div className="space-y-4">
      {/* Empty state */}
      {!automations.length && !showForm && (
        <div className="text-center py-14 bg-white rounded-xl border border-dashed border-slate-200">
          <div className="text-4xl mb-3">⚡</div>
          <div className="font-display text-base font-bold text-slate-800 mb-1.5">No custom automations yet</div>
          <div className="text-sm text-slate-400 mb-5 max-w-sm mx-auto">
            Build rules like &ldquo;send a review request 1 day after checkout&rdquo; or &ldquo;remind long-term guests 5 days before check-in.&rdquo;
          </div>
          <button type="button" onClick={openNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-400 hover:bg-teal-500 text-slate-900 text-sm font-bold rounded-lg transition-colors">
            <PlusIcon className="h-4 w-4" />
            New Automation
          </button>
        </div>
      )}

      {/* New Automation button (shown when automations exist and form is not open) */}
      {automations.length > 0 && !showForm && (
        <div className="flex justify-end mb-4">
          <button type="button" onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-400 hover:bg-teal-500 text-slate-900 text-sm font-bold rounded-lg transition-colors">
            <PlusIcon className="h-4 w-4" />
            New Automation
          </button>
        </div>
      )}

      {/* Automations list */}
      {automations.map((a) => (
        <div key={a.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3.5 flex items-center gap-3 shadow-sm">
          <div className="flex-1 min-w-0">
            <div className="font-display text-sm font-bold text-slate-800">{a.name || 'Untitled'}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              When <strong className="text-slate-600">{TRIGGER_EVENT_LABELS[a.trigger_event] ?? a.trigger_event}</strong>
              {' → '}{Math.abs(a.delay_minutes) === 0 ? 'immediately' : `${Math.abs(a.delay_minutes)} min ${a.delay_minutes < 0 ? 'before' : 'after'}`}
              {' → send to '}<strong className="text-slate-600">{a.recipient_type}</strong>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide ${a.is_active ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
            {a.is_active ? 'Active' : 'Off'}
          </span>
          <button type="button" onClick={() => openEdit(a)}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => handleDelete(a.id)} disabled={deleting === a.id}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors disabled:opacity-50">
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {/* New / Edit form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-base flex-shrink-0">⚡</div>
            <div className="font-display text-sm font-bold text-slate-900">
              {editingId ? 'Edit Automation' : 'New Custom Automation'}
            </div>
          </div>

          {/* Body */}
          <div className="p-5">
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {/* Trigger Event */}
                <div>
                  <label className={labelClass} htmlFor="auto-trigger">Trigger Event</label>
                  <select
                    id="auto-trigger"
                    value={form.trigger_event}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, trigger_event: e.target.value as TriggerEvent }))
                    }
                    className={selectClass}
                  >
                    {Object.entries(TRIGGER_EVENT_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Send To */}
                <div>
                  <label className={labelClass} htmlFor="auto-recipient">Send To</label>
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

                {/* Delay — full width */}
                <div className="sm:col-span-2">
                  <label className={labelClass}>Delay</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={form.delayValue}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, delayValue: Number(e.target.value) }))
                      }
                      className="w-20 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-teal-400"
                    />
                    <select
                      value={form.delayUnit}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, delayUnit: e.target.value as DelayUnit }))
                      }
                      className="flex-1 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-teal-400"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                    <select
                      value={form.delayDir}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, delayDir: e.target.value as DelayDir }))
                      }
                      className="flex-1 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-teal-400"
                    >
                      <option value="after">After</option>
                      <option value="before">Before</option>
                    </select>
                  </div>
                </div>

                {/* Template */}
                <div>
                  <label className={labelClass} htmlFor="auto-template">Template</label>
                  <select
                    id="auto-template"
                    value={form.template_id}
                    onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">No template</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {/* Automation Name */}
                <div>
                  <label className={labelClass} htmlFor="auto-name">Automation Name</label>
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

                {/* Active toggle */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.is_active}
                    onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.is_active ? 'bg-teal-400' : 'bg-slate-200'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-sm text-slate-500">{form.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              {/* Flow preview */}
              <div className="mt-4 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-2 flex-wrap text-xs">
                <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                  ⚡ {TRIGGER_EVENT_LABELS[form.trigger_event] ?? form.trigger_event}
                </span>
                <span className="text-slate-400">
                  → wait {form.delayValue} {form.delayUnit} {form.delayValue > 0 ? form.delayDir : ''} →
                </span>
                <span className="px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 font-semibold">
                  ✉ {templates.find((t) => t.id === form.template_id)?.name ?? 'select template'}
                </span>
                <span className="text-slate-400">→ to</span>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                  👤 {form.recipient_type}
                </span>
              </div>

              {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

              {/* Footer buttons */}
              <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  aria-label="Save Automation"
                  className="px-5 py-2.5 rounded-lg bg-teal-400 hover:bg-teal-500 text-slate-900 text-sm font-bold transition-colors disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Automation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
