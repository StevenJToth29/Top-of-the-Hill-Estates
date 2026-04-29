'use client'

import { useState } from 'react'
import type { Person } from '@/types'

interface Props {
  initialPeople: Person[]
  onPersonAdded?: (person: Person) => void
  onPersonDeleted?: (id: string) => void
}

export function PeopleManager({ initialPeople, onPersonAdded, onPersonDeleted }: Props) {
  const [people, setPeople] = useState<Person[]>(initialPeople)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

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
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Failed to add'); }
      const person: Person = await res.json()
      setPeople((prev) => [...prev, person])
      onPersonAdded?.(person)
      setNewName('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/people/${id}`, { method: 'DELETE' })
    setPeople((prev) => prev.filter((p) => p.id !== id))
    onPersonDeleted?.(id)
  }

  function handleCopyLink(token: string) {
    navigator.clipboard.writeText(`${baseUrl}/api/ical/cleaner/${token}`)
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-800">People</h3>

      <div className="flex gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
          placeholder="Name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <button
          className="px-4 py-2 text-sm rounded-lg bg-primary text-white disabled:opacity-50"
          onClick={handleAdd}
          disabled={saving || !newName.trim()}
        >
          Add
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="divide-y border rounded-xl overflow-hidden">
        {people.length === 0 && (
          <p className="px-4 py-3 text-sm text-gray-400">No people yet.</p>
        )}
        {people.map((person) => (
          <div key={person.id} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-gray-800">{person.name}</span>
            <div className="flex items-center gap-3">
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => handleCopyLink(person.ical_token)}
              >
                Copy iCal Link
              </button>
              <button
                className="text-xs text-red-500 hover:underline"
                onClick={() => handleDelete(person.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
