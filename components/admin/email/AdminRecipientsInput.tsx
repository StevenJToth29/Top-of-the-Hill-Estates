'use client'

import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface Props {
  value: string[]
  onChange: (value: string[]) => void
}

export default function AdminRecipientsInput({ value, onChange }: Props) {
  const [input, setInput] = useState('')

  function add() {
    const trimmed = input.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInput('')
  }

  return (
    <div className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 focus-within:ring-1 focus-within:ring-secondary/50 min-h-[48px]">
      <div className="flex flex-wrap gap-2">
        {value.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1.5 bg-surface-high rounded-lg px-3 py-1 text-sm text-on-surface"
          >
            {email}
            <button
              type="button"
              onClick={() => onChange(value.filter((e) => e !== email))}
              aria-label={`Remove ${email}`}
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          type="email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Add email and press Enter"
          className="flex-1 min-w-40 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
        />
      </div>
    </div>
  )
}
