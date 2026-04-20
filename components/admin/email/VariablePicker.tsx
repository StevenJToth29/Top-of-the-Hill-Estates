'use client'

import { useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { VARIABLE_GROUPS } from '@/lib/email-variables'

interface Props {
  onSelect: (key: string) => void
  buttonLabel?: string
}

export default function VariablePicker({ onSelect, buttonLabel = 'Insert Variable' }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={buttonLabel}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium bg-surface-high text-on-surface hover:bg-surface-highest/80 transition-colors focus:outline-none focus:ring-1 focus:ring-secondary/50"
      >
        {'{{'}
        <span className="mx-0.5">{buttonLabel}</span>
        <ChevronDownIcon className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 left-0 top-full mt-1 w-64 bg-surface-container rounded-xl shadow-lg border border-surface-high overflow-auto max-h-72 py-1">
            {VARIABLE_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                  {group.label}
                </div>
                {group.variables.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    className="w-full text-left px-4 py-1.5 text-sm text-on-surface hover:bg-surface-high transition-colors"
                    onClick={() => {
                      onSelect(v.key)
                      setOpen(false)
                    }}
                  >
                    <span className="font-mono text-primary">{`{{${v.key}}}`}</span>
                    <span className="ml-2 text-on-surface-variant text-xs">{v.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
