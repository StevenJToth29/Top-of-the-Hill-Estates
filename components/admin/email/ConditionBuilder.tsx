'use client'

import type { ConditionBlock, ConditionRule } from '@/types'

const CONDITION_FIELDS = [
  { value: 'booking_type', label: 'Booking type' },
  { value: 'total_nights', label: 'Total nights' },
  { value: 'total_amount', label: 'Total amount' },
  { value: 'room_id', label: 'Room ID' },
  { value: 'property_id', label: 'Property ID' },
  { value: 'is_returning_guest', label: 'Returning guest' },
  { value: 'marketing_consent', label: 'Marketing consent' },
  { value: 'sms_consent', label: 'SMS consent' },
]

const CONDITION_OPS: { value: ConditionRule['op']; label: string }[] = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
]

interface Props {
  value: ConditionBlock
  onChange: (value: ConditionBlock) => void
}

export default function ConditionBuilder({ value, onChange }: Props) {
  function addRule() {
    onChange({
      ...value,
      rules: [...value.rules, { field: 'booking_type', op: 'eq', value: '' }],
    })
  }

  function removeRule(idx: number) {
    onChange({ ...value, rules: value.rules.filter((_, i) => i !== idx) })
  }

  function updateRule(idx: number, patch: Partial<ConditionRule>) {
    onChange({
      ...value,
      rules: value.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    })
  }

  const selectClass =
    'bg-surface-highest/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50'

  return (
    <div className="space-y-3">
      {value.rules.length >= 2 && (
        <div className="flex gap-2">
          {(['AND', 'OR'] as const).map((op) => (
            <button
              key={op}
              type="button"
              aria-label={op}
              onClick={() => onChange({ ...value, operator: op })}
              className={[
                'rounded-lg px-3 py-1 text-xs font-semibold transition-colors',
                value.operator === op
                  ? 'bg-primary text-background'
                  : 'bg-surface-high text-on-surface-variant hover:text-on-surface',
              ].join(' ')}
            >
              {op}
            </button>
          ))}
        </div>
      )}

      {value.rules.map((rule, idx) => (
        <div key={idx} className="flex items-center gap-2 flex-wrap">
          <select
            value={rule.field}
            onChange={(e) => updateRule(idx, { field: e.target.value })}
            className={selectClass}
          >
            {CONDITION_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={rule.op}
            onChange={(e) => updateRule(idx, { op: e.target.value as ConditionRule['op'] })}
            className={selectClass}
          >
            {CONDITION_OPS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={String(rule.value)}
            onChange={(e) => updateRule(idx, { value: e.target.value })}
            placeholder="value"
            className="flex-1 min-w-24 bg-surface-highest/40 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50"
          />
          <button
            type="button"
            aria-label="Remove condition"
            onClick={() => removeRule(idx)}
            className="rounded-lg px-2.5 py-2 text-on-surface-variant hover:bg-surface-high hover:text-red-400 transition-colors text-sm"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        aria-label="Add condition"
        onClick={addRule}
        className="text-sm text-primary hover:underline"
      >
        + Add Condition
      </button>
    </div>
  )
}
