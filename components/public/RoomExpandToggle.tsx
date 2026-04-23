'use client'

import { useState } from 'react'

interface Props {
  houseRules: string
}

export default function RoomExpandToggle({ houseRules }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-outline-variant/20 space-y-3">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant font-body">
            House Rules
          </p>
          <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
            {houseRules}
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-sm font-semibold text-secondary hover:text-secondary/80 transition-colors mt-1"
      >
        {expanded ? 'Show less ↑' : 'Read more ↓'}
      </button>
    </>
  )
}
