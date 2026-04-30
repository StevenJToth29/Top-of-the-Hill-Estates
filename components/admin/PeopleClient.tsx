'use client'

import { useState } from 'react'
import {
  PlusIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  LinkIcon,
} from '@heroicons/react/24/outline'
import type { Person } from '@/types'

interface Props {
  initialPeople: Person[]
}

export default function PeopleClient({ initialPeople }: Props) {
  const [people, setPeople] = useState<Person[]>(initialPeople)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function origin() {
    return typeof window !== 'undefined' ? window.location.origin : ''
  }

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Failed to add') }
      const person: Person = await res.json()
      setPeople(prev => [...prev, person].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      setAdding(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/people/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Failed to rename') }
      const updated: Person = await res.json()
      setPeople(prev => prev.map(p => p.id === id ? updated : p).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingId(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/people/${id}`, { method: 'DELETE' })
    setPeople(prev => prev.filter(p => p.id !== id))
  }

  function handleCopy(token: string, id: string) {
    navigator.clipboard.writeText(`${origin()}/api/ical/cleaner/${token}`)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-on-surface">People</h1>
          <p className="text-on-surface-variant mt-1 text-sm">
            {people.length} person{people.length !== 1 ? 's' : ''} · assignable to tasks and automations
          </p>
        </div>
        <button
          onClick={() => { setAdding(true); setError(null) }}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-5 py-2.5 hover:opacity-90 transition-opacity"
        >
          <PlusIcon className="w-4 h-4" />
          Add Person
        </button>
      </div>

      {/* Inline add row */}
      {adding && (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl border border-outline-variant/20 p-4 flex items-center gap-3">
          <input
            autoFocus
            className="flex-1 bg-surface-container rounded-xl px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 border border-outline-variant/20"
            placeholder="Full name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd()
              if (e.key === 'Escape') { setAdding(false); setNewName('') }
            }}
          />
          <button
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className="flex items-center gap-1.5 bg-secondary text-background text-sm font-semibold rounded-xl px-4 py-2.5 disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            <CheckIcon className="w-4 h-4" />
            Save
          </button>
          <button
            onClick={() => { setAdding(false); setNewName(''); setError(null) }}
            className="text-on-surface-variant hover:text-on-surface p-2 rounded-xl hover:bg-surface-container transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-error bg-error-container/20 rounded-xl px-4 py-2">{error}</p>
      )}

      {/* List */}
      {people.length === 0 && !adding ? (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-12 text-center space-y-2">
          <p className="text-on-surface-variant">No people yet.</p>
          <button
            onClick={() => setAdding(true)}
            className="text-secondary hover:underline text-sm"
          >
            Add your first person
          </button>
        </div>
      ) : (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl border border-outline-variant/20 divide-y divide-outline-variant/10 overflow-hidden">
          {people.map(person => (
            <div
              key={person.id}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-container/30 transition-colors"
            >
              {/* Initial avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/30 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-secondary">
                  {person.name.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Name / edit */}
              <div className="flex-1 min-w-0">
                {editingId === person.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      className="bg-surface-container rounded-lg px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary/50 border border-outline-variant/20 w-48"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(person.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                    <button
                      onClick={() => handleRename(person.id)}
                      disabled={saving}
                      className="text-secondary hover:text-secondary/80 transition-colors"
                    >
                      <CheckIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-on-surface truncate">{person.name}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCopy(person.ical_token, person.id)}
                  title="Copy personal iCal feed link"
                  className="flex items-center gap-1.5 text-xs text-on-surface-variant hover:text-secondary transition-colors px-2.5 py-1.5 rounded-lg hover:bg-surface-container border border-outline-variant/20"
                >
                  {copiedId === person.id
                    ? <CheckIcon className="w-3.5 h-3.5 text-secondary" />
                    : <LinkIcon className="w-3.5 h-3.5" />
                  }
                  {copiedId === person.id ? 'Copied!' : 'iCal Link'}
                </button>

                {editingId !== person.id && (
                  <button
                    onClick={() => { setEditingId(person.id); setEditName(person.name) }}
                    title="Rename"
                    className="p-1.5 text-on-surface-variant hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => handleDelete(person.id)}
                  title="Delete"
                  className="p-1.5 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-error-container/20"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
