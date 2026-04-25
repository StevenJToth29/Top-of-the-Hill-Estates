'use client'

import { useState, useRef } from 'react'
import type { GuestIdDocument } from '@/types'

interface IdUploadStepProps {
  bookingId: string
  guestCount: number
  savedDocs: GuestIdDocument[]
  onAllPassed: (docs: GuestIdDocument[]) => void
}

interface GuestDraftState {
  name: string
  address: string
  file: File | null
  uploading: boolean
  doc: GuestIdDocument | null
  error: string | null
}

export default function IdUploadStep({ bookingId, guestCount, savedDocs, onAllPassed }: IdUploadStepProps) {
  const initialDrafts: GuestDraftState[] = Array.from({ length: guestCount }, (_, i) => {
    const saved = savedDocs.find((d) => d.guest_index === i + 1) ?? null
    return {
      name: saved?.guest_name ?? '',
      address: saved?.current_address ?? '',
      file: null,
      uploading: false,
      doc: saved,
      error: null,
    }
  })
  const [drafts, setDrafts] = useState<GuestDraftState[]>(initialDrafts)
  const fileRefs = useRef<(HTMLInputElement | null)[]>([])

  function updateDraft(idx: number, patch: Partial<GuestDraftState>) {
    setDrafts((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  async function handleUpload(idx: number, file: File, name: string, address: string) {
    updateDraft(idx, { uploading: true, error: null, file })

    const buffer = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
    const storageKey = `${bookingId}/${idx + 1}-${Date.now()}-${file.name}`

    const res = await fetch(`/api/bookings/${bookingId}/validate-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest_index: idx + 1,
        guest_name: name,
        current_address: address,
        id_photo_url: storageKey,
        image_base64: base64,
        image_mime_type: file.type,
      }),
    })

    const data = await res.json()
    updateDraft(idx, { uploading: false })

    if (!res.ok) {
      updateDraft(idx, { error: data.error ?? 'Upload failed. Please try again.' })
      return
    }

    if (!data.quality_passed) {
      updateDraft(idx, { error: data.quality_error, doc: null, file: null })
      if (fileRefs.current[idx]) fileRefs.current[idx]!.value = ''
      return
    }

    updateDraft(idx, { doc: data.document, error: null })

    setDrafts((prev) => {
      const allDocs = prev.map((d, i) => (i === idx ? data.document : d.doc)).filter(Boolean) as GuestIdDocument[]
      if (allDocs.length === guestCount && allDocs.every((d) => d.ai_quality_result === 'pass')) {
        onAllPassed(allDocs)
      }
      return prev
    })
  }

  const allPassed = drafts.every((d) => d.doc?.ai_quality_result === 'pass')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-on-surface mb-1">Guest Identification</h2>
        <p className="text-on-surface-variant text-sm">
          Upload a clear, full photo of a valid government-issued ID for each guest.
        </p>
      </div>

      {drafts.map((draft, idx) => {
        const passed = draft.doc?.ai_quality_result === 'pass'

        return (
          <div
            key={idx}
            className={`border rounded-xl p-5 space-y-4 ${
              passed ? 'border-secondary/50 bg-secondary/5' : draft.error ? 'border-error/50 bg-error/5' : 'border-outline'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-on-surface text-sm">
                Guest {idx + 1}{idx === 0 ? ' (Primary)' : ''}
              </span>
              {passed && (
                <span className="text-xs font-semibold text-secondary bg-secondary/10 px-2 py-1 rounded-full">
                  ✓ ID Verified
                </span>
              )}
              {draft.error && (
                <span className="text-xs font-semibold text-error bg-error/10 px-2 py-1 rounded-full">
                  ✗ Re-upload Required
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={`guest-${idx}-name`} className="block text-on-surface-variant text-xs mb-1">Full Name</label>
                <input
                  id={`guest-${idx}-name`}
                  type="text"
                  value={draft.name}
                  onChange={(e) => updateDraft(idx, { name: e.target.value })}
                  disabled={passed}
                  placeholder="As shown on ID"
                  className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 disabled:opacity-60"
                />
              </div>
              <div>
                <label htmlFor={`guest-${idx}-address`} className="block text-on-surface-variant text-xs mb-1">Current Address</label>
                <input
                  id={`guest-${idx}-address`}
                  type="text"
                  value={draft.address}
                  onChange={(e) => updateDraft(idx, { address: e.target.value })}
                  disabled={passed}
                  placeholder="Street, City, State ZIP"
                  className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-on-surface-variant text-xs mb-1">Photo ID</label>
              {passed ? (
                <div className="rounded-xl bg-secondary/10 border border-secondary/30 px-4 py-3 text-secondary text-sm font-medium">
                  ✓ ID uploaded and verified
                </div>
              ) : (
                <>
                  <input
                    ref={(el) => { fileRefs.current[idx] = el }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    aria-label={`Upload photo ID for Guest ${idx + 1}`}
                    disabled={draft.uploading || !draft.name.trim() || !draft.address.trim()}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(idx, file, draft.name, draft.address)
                    }}
                    className="block w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-secondary/10 file:text-secondary hover:file:bg-secondary/20 disabled:opacity-50"
                  />
                  {(!draft.name.trim() || !draft.address.trim()) && (
                    <p className="text-xs text-on-surface-variant mt-1">Enter name and address above before uploading</p>
                  )}
                  {draft.uploading && (
                    <p className="text-xs text-on-surface-variant mt-1">Checking ID quality…</p>
                  )}
                  {draft.error && (
                    <p className="text-xs text-error mt-1">{draft.error}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}

      {!allPassed && (
        <p className="text-sm text-on-surface-variant text-center">
          All {guestCount} guest ID{guestCount > 1 ? 's' : ''} must be verified before continuing
        </p>
      )}
    </div>
  )
}
