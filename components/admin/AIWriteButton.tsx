'use client'

import { useState, useRef } from 'react'
import { SparklesIcon, XMarkIcon, ArrowPathIcon, CheckIcon } from '@heroicons/react/24/outline'

interface AIWriteButtonProps {
  fieldType: 'short_description' | 'room_description' | 'property_description' | 'about_us'
  context: string
  onAccept: (text: string) => void
}

export default function AIWriteButton({ fieldType, context, onAccept }: AIWriteButtonProps) {
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  async function generate() {
    setError('')
    setResult('')
    setLoading(true)

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/admin/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldType, context, hint }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Generation failed')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let text = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setResult(text)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Generation failed')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleAccept() {
    onAccept(result)
    setOpen(false)
    setResult('')
    setHint('')
  }

  function handleClose() {
    abortRef.current?.abort()
    setOpen(false)
    setResult('')
    setHint('')
    setError('')
  }

  return (
    <div className="space-y-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs text-secondary/80 hover:text-secondary transition-colors"
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          Write with AI
        </button>
      ) : (
        <div className="bg-surface-container rounded-2xl p-4 space-y-3 border border-secondary/20">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-secondary uppercase tracking-wider">
              <SparklesIcon className="w-3.5 h-3.5" />
              Write with AI
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="text-on-surface-variant/50 hover:text-on-surface-variant transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); generate() } }}
            placeholder="Optional: any specific angle or tone? (e.g. 'emphasize mountain views')"
            className="w-full bg-surface-highest/40 rounded-xl px-3 py-2 text-sm text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:ring-1 focus:ring-secondary/50"
          />

          {result && (
            <div className="bg-surface-highest/30 rounded-xl px-3 py-2.5 text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
              {result}
              {loading && <span className="inline-block w-1.5 h-4 bg-secondary/60 animate-pulse ml-0.5 align-middle" />}
            </div>
          )}

          {error && (
            <p className="text-xs text-error">{error}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1.5 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {result ? 'Regenerate' : 'Generate'}
            </button>

            {result && !loading && (
              <button
                type="button"
                onClick={handleAccept}
                className="flex items-center gap-1.5 bg-secondary text-background rounded-xl px-3 py-2 text-xs font-medium hover:opacity-90 transition-opacity"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                Use this
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
