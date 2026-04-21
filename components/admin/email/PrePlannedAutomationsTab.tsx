'use client'

import { useState, useEffect } from 'react'
import type { EmailAutomation, EmailTemplate } from '@/types'

type DelayState = {
  value: number
  unit: 'minutes' | 'hours' | 'days'
  direction: 'before' | 'after'
}

function decodeDelay(minutes: number): DelayState {
  const abs = Math.abs(minutes)
  const direction: 'before' | 'after' = minutes < 0 ? 'before' : 'after'
  if (abs === 0) return { value: 0, unit: 'minutes', direction: 'after' }
  if (abs % 1440 === 0) return { value: abs / 1440, unit: 'days', direction }
  if (abs % 60 === 0) return { value: abs / 60, unit: 'hours', direction }
  return { value: abs, unit: 'minutes', direction }
}

function encodeDelay({ value, unit, direction }: DelayState): number {
  const m =
    unit === 'hours' ? value * 60 : unit === 'days' ? value * 1440 : value
  return direction === 'before' ? -m : m
}

interface RowState {
  automation: EmailAutomation
  delay: DelayState
}

interface Props {
  automations: EmailAutomation[]
  templates: EmailTemplate[]
}

function AutoRow({
  a,
  delay,
  isEven,
  templates,
  onToggle,
  onUpdate,
  onSaveDelay,
  onTemplateChange,
}: {
  a: EmailAutomation
  delay: DelayState
  isEven: boolean
  templates: EmailTemplate[]
  onToggle: () => void
  onUpdate: (u: { delay?: DelayState }) => void
  onSaveDelay: (ds: DelayState) => void
  onTemplateChange: (id: string | null) => void
}) {
  const [editDelay, setEditDelay] = useState(false)
  const [localDelay, setLocalDelay] = useState(delay)

  useEffect(() => setLocalDelay(delay), [delay])

  const recipientBadge =
    a.recipient_type === 'admin'
      ? { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' }
      : { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' }

  const timingLabel =
    localDelay.value === 0
      ? 'Immediately'
      : `${localDelay.value} ${localDelay.unit} ${localDelay.direction}`

  const inputClass =
    'bg-slate-50 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-teal-400'
  const rowBg = isEven ? 'bg-white' : 'bg-slate-50/50'

  return (
    <tr className={`${rowBg} hover:bg-teal-50/20 transition-colors`}>
      {/* Event */}
      <td className="px-4 py-3 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-800">{a.name}</span>
      </td>

      {/* Template */}
      <td className="px-4 py-3 border-b border-slate-100">
        <select
          value={a.template_id ?? ''}
          onChange={(e) => onTemplateChange(e.target.value || null)}
          className={inputClass + ' max-w-[180px]'}
        >
          <option value="">No template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </td>

      {/* Timing */}
      <td className="px-4 py-3 border-b border-slate-100">
        {editDelay ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              value={localDelay.value}
              onChange={(e) =>
                setLocalDelay((d) => ({ ...d, value: Number(e.target.value) }))
              }
              className={inputClass + ' w-14'}
            />
            <select
              value={localDelay.unit}
              onChange={(e) =>
                setLocalDelay((d) => ({
                  ...d,
                  unit: e.target.value as DelayState['unit'],
                }))
              }
              className={inputClass}
            >
              <option value="minutes">min</option>
              <option value="hours">hrs</option>
              <option value="days">days</option>
            </select>
            {localDelay.value > 0 && (
              <select
                value={localDelay.direction}
                onChange={(e) =>
                  setLocalDelay((d) => ({
                    ...d,
                    direction: e.target.value as DelayState['direction'],
                  }))
                }
                className={inputClass}
              >
                <option value="after">after</option>
                <option value="before">before</option>
              </select>
            )}
            <button
              onClick={() => {
                onSaveDelay(localDelay)
                onUpdate({ delay: localDelay })
                setEditDelay(false)
              }}
              className="px-2.5 py-1.5 bg-teal-400 text-slate-900 text-xs font-bold rounded-md"
            >
              ✓
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">{timingLabel}</span>
            <button
              onClick={() => setEditDelay(true)}
              className="text-[11px] px-2 py-0.5 rounded border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            >
              Edit
            </button>
          </div>
        )}
      </td>

      {/* Send To */}
      <td className="px-4 py-3 border-b border-slate-100">
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide ${recipientBadge.bg} ${recipientBadge.text} ${recipientBadge.border}`}
        >
          {a.recipient_type === 'admin'
            ? 'Admin'
            : a.recipient_type === 'both'
            ? 'Both'
            : 'Guest'}
        </span>
      </td>

      {/* Active */}
      <td className="px-4 py-3 border-b border-slate-100 text-center">
        <button
          type="button"
          onClick={onToggle}
          aria-label={`Toggle ${a.name}`}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            a.is_active ? 'bg-teal-400' : 'bg-slate-200'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
              a.is_active ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </td>
    </tr>
  )
}

export default function PrePlannedAutomationsTab({ automations, templates }: Props) {
  const [rows, setRows] = useState<RowState[]>(() =>
    automations.map((a) => ({
      automation: a,
      delay: decodeDelay(a.delay_minutes),
    })),
  )
  const [error, setError] = useState<string | null>(null)

  async function patchAutomation(id: string, patch: Partial<EmailAutomation>) {
    const prev = rows
    setError(null)
    setRows((current) =>
      current.map((r) =>
        r.automation.id === id
          ? { ...r, automation: { ...r.automation, ...patch } }
          : r,
      ),
    )
    const res = await fetch(`/api/admin/email/automations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      setRows(prev)
      const json = await res.json().catch(() => ({}))
      setError((json as { error?: string }).error ?? 'Failed to save — please try again')
    }
  }

  async function saveDelay(id: string, delayState: DelayState) {
    await patchAutomation(id, { delay_minutes: encodeDelay(delayState) })
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-400 px-1">{error}</p>}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {['Event', 'Template', 'Timing', 'Send To', 'Active'].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 whitespace-nowrap ${
                    i === 4 ? 'text-center' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ automation: a, delay }, i) => (
              <AutoRow
                key={a.id}
                a={a}
                delay={delay}
                isEven={i % 2 === 0}
                templates={templates}
                onToggle={() => patchAutomation(a.id, { is_active: !a.is_active })}
                onUpdate={(updated) =>
                  setRows((prev) =>
                    prev.map((r) =>
                      r.automation.id === a.id ? { ...r, ...updated } : r,
                    ),
                  )
                }
                onSaveDelay={(ds) => saveDelay(a.id, ds)}
                onTemplateChange={(id) =>
                  patchAutomation(a.id, { template_id: id || null })
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
