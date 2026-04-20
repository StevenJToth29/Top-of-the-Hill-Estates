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
      <div className="flex gap-2 mb-6">
        {(['pre-planned', 'custom'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              'rounded-xl px-4 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'bg-surface-highest text-on-surface'
                : 'text-on-surface-variant hover:bg-surface-high hover:text-on-surface',
            ].join(' ')}
          >
            {t === 'pre-planned' ? 'Pre-Planned' : 'Custom'}
          </button>
        ))}
      </div>

      {tab === 'pre-planned' ? (
        <PrePlannedAutomationsTab automations={prePlanned} templates={templates} />
      ) : (
        <CustomAutomationsTab automations={custom} templates={templates} />
      )}
    </div>
  )
}
