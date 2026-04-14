'use client'

import { useState } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'

interface DeletePropertyButtonProps {
  propertyId: string
  hasRooms: boolean
}

export default function DeletePropertyButton({ propertyId, hasRooms }: DeletePropertyButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Delete this property? This cannot be undone.')) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/properties', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: propertyId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Delete failed')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setLoading(false)
    }
  }

  if (hasRooms) {
    return (
      <span
        title="Remove all rooms from this property before deleting it."
        className="flex items-center gap-1.5 text-sm text-on-surface-variant/40 cursor-not-allowed select-none"
      >
        <TrashIcon className="w-4 h-4" />
        Delete
      </span>
    )
  }

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="flex items-center gap-1.5 text-sm text-error hover:text-error/80 transition-colors disabled:opacity-50"
      >
        <TrashIcon className="w-4 h-4" />
        {loading ? 'Deleting…' : 'Delete'}
      </button>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  )
}
