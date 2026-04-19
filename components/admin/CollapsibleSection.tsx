'use client'

import { useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export default function CollapsibleSection({ title, defaultOpen = true, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-surface-high/20 transition-colors"
      >
        <h2 className="font-display text-lg font-semibold text-on-surface">{title}</h2>
        <ChevronDownIcon
          className={`w-4 h-4 text-on-surface-variant shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-6 pb-6 space-y-5">{children}</div>}
    </div>
  )
}
