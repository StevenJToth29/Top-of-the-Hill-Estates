'use client'

import { useState } from 'react'
import PrePlannedAutomationsTab from './PrePlannedAutomationsTab'
import CustomAutomationsTab from './CustomAutomationsTab'
import type { EmailAutomation, EmailTemplate } from '@/types'

interface Props {
  automations: EmailAutomation[]
  templates: EmailTemplate[]
}

export default function EmailAutomationsPage({ automations, templates }: Props) {
  const [tab, setTab] = useState<'pre-planned' | 'custom'>('pre-planned')

  const prePlanned = automations.filter((a) => a.is_pre_planned)
  const custom = automations.filter((a) => !a.is_pre_planned)

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-fit">
        {(['pre-planned', 'custom'] as const).map((t) => {
          const active = tab === t
          const label = t === 'pre-planned' ? 'Pre-Planned' : 'Custom'
          const count = t === 'pre-planned' ? prePlanned.filter((a) => a.is_active).length : null
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                'px-5 py-2 rounded-lg text-sm font-semibold transition-all',
                active
                  ? 'bg-teal-400 text-slate-900 shadow-sm'
                  : 'bg-transparent text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {label}
              {count !== null && (
                <span className="ml-1.5 text-xs opacity-70">({count} active)</span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'pre-planned' && (
        <div className="mb-4 px-4 py-3 bg-teal-50 rounded-xl border border-teal-200/60 text-sm text-slate-600">
          <strong className="text-teal-700 font-semibold">Pre-planned automations</strong> fire based on booking lifecycle events. Toggle each on/off and adjust the delay if needed.
        </div>
      )}

      {tab === 'pre-planned' ? (
        <PrePlannedAutomationsTab automations={prePlanned} templates={templates} />
      ) : (
        <CustomAutomationsTab automations={custom} templates={templates} />
      )}
    </div>
  )
}
