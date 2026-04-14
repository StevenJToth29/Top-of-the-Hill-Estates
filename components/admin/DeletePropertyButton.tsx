'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { TrashIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'

interface DeletePropertyButtonProps {
  propertyId: string
  propertyName: string
  hasRooms: boolean
}

export default function DeletePropertyButton({ propertyId, propertyName, hasRooms }: DeletePropertyButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleConfirm() {
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
      setShowModal(false)
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
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 text-sm text-error hover:text-error/80 transition-colors"
      >
        <TrashIcon className="w-4 h-4" />
        Delete
      </button>

      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-on-surface/30 backdrop-blur-sm"
            onClick={() => !loading && setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-background rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-error-container/40 flex items-center justify-center">
                  <ExclamationTriangleIcon className="w-5 h-5 text-error" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-on-surface">Delete Property</h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">This cannot be undone</p>
                </div>
              </div>
              <button
                onClick={() => !loading && setShowModal(false)}
                className="text-on-surface-variant hover:text-on-surface transition-colors mt-0.5"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-on-surface-variant">
              Are you sure you want to delete <span className="font-medium text-on-surface">{propertyName}</span>? This action is permanent and cannot be reversed.
            </p>

            {error && (
              <p className="text-sm text-error bg-error-container/30 rounded-xl px-4 py-2">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-sm font-medium text-on-surface-variant bg-surface-container hover:bg-surface-high transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-sm font-medium text-background bg-error hover:bg-error/90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Deleting…' : 'Delete Property'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
