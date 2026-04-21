'use client'

import { useState } from 'react'
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

const RECIPIENT_LABELS: Record<string, string> = {
  guest: 'Guest',
  admin: 'Admin',
  both: 'Both',
}

interface RowState {
  automation: EmailAutomation
  delay: DelayState
}

interface Props {
  automations: EmailAutomation[]
  templates: EmailTemplate[]
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

  const selectClass =
    'bg-surface-highest/40 rounded-lg px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50'

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-400 px-1">{error}</p>
      )}
      {rows.map(({ automation: a, delay }) => (
        <div
          key={a.id}
          className="flex flex-wrap items-center gap-3 bg-surface-highest/40 rounded-xl px-4 py-3"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-on-surface text-sm">{a.name}</p>
          </div>

          <button
            type="button"
            aria-label={`Toggle ${a.name}`}
            onClick={() => patchAutomation(a.id, { is_active: !a.is_active })}
            className={[
              'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
              a.is_active ? 'bg-primary' : 'bg-surface-high',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform',
                a.is_active ? 'translate-x-5' : 'translate-x-0.5',
              ].join(' ')}
            />
          </button>

          <select
            value={a.template_id ?? ''}
            onChange={(e) =>
              patchAutomation(a.id, { template_id: e.target.value || null })
            }
            className={selectClass}
          >
            <option value="">No template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              value={delay.value}
              onChange={(e) => {
                const updated = { ...delay, value: Number(e.target.value) }
                setRows((prev) =>
                  prev.map((r) =>
                    r.automation.id === a.id ? { ...r, delay: updated } : r,
                  ),
                )
              }}
              onBlur={() => saveDelay(a.id, delay)}
              className="w-16 bg-surface-highest/40 rounded-lg px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
            />
            <select
              value={delay.unit}
              onChange={(e) => {
                const updated = {
                  ...delay,
                  unit: e.target.value as DelayState['unit'],
                }
                setRows((prev) =>
                  prev.map((r) =>
                    r.automation.id === a.id ? { ...r, delay: updated } : r,
                  ),
                )
                saveDelay(a.id, updated)
              }}
              className={selectClass}
            >
              <option value="minutes">min</option>
              <option value="hours">hrs</option>
              <option value="days">days</option>
            </select>
            {delay.value > 0 && (
              <select
                value={delay.direction}
                onChange={(e) => {
                  const updated = {
                    ...delay,
                    direction: e.target.value as DelayState['direction'],
                  }
                  setRows((prev) =>
                    prev.map((r) =>
                      r.automation.id === a.id ? { ...r, delay: updated } : r,
                    ),
                  )
                  saveDelay(a.id, updated)
                }}
                className={selectClass}
              >
                <option value="after">after</option>
                <option value="before">before</option>
              </select>
            )}
          </div>

          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-surface-high text-on-surface-variant">
            {RECIPIENT_LABELS[a.recipient_type] ?? a.recipient_type}
          </span>
        </div>
      ))}
    </div>
  )
}
