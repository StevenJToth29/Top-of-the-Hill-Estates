'use client'

import { useState, useRef, useEffect } from 'react'
import type { GuestIdDocument } from '@/types'
import PlacesAddressInput from '@/components/admin/PlacesAddressInput'

interface IdUploadStepProps {
  bookingId: string
  guestCount: number
  savedDocs: GuestIdDocument[]
  onAllPassed: (docs: GuestIdDocument[]) => void
}

interface GuestDraftState {
  name: string
  addressStreet: string
  addressCity: string
  addressState: string
  addressZip: string
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
      addressStreet: '',
      addressCity: '',
      addressState: '',
      addressZip: '',
      file: null,
      uploading: false,
      doc: saved,
      error: null,
    }
  })
  const [drafts, setDrafts] = useState<GuestDraftState[]>(initialDrafts)
  const draftsRef = useRef(drafts)
  useEffect(() => { draftsRef.current = drafts }, [drafts])
  const fileRefs = useRef<(HTMLInputElement | null)[]>([])

  function updateDraft(idx: number, patch: Partial<GuestDraftState>) {
    setDrafts((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  async function saveAddress(idx: number) {
    const draft = draftsRef.current[idx]
    if (!draft.doc) return
    const current_address = [draft.addressStreet, draft.addressCity, draft.addressState, draft.addressZip]
      .filter(Boolean).join(', ')
    await fetch(`/api/bookings/${bookingId}/validate-id`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_index: idx + 1, guest_name: draft.name, current_address }),
    })
  }

  async function handleUpload(idx: number, file: File) {
    updateDraft(idx, { uploading: true, error: null, file })

    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)
    const storageKey = `${bookingId}/${idx + 1}-${Date.now()}-${file.name}`

    const res = await fetch(`/api/bookings/${bookingId}/validate-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest_index: idx + 1,
        guest_name: '',
        current_address: '',
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

    const ext = data.extracted ?? {}
    updateDraft(idx, {
      doc: data.document,
      error: null,
      name: ext.name || '',
      addressStreet: ext.address_street || '',
      addressCity: ext.address_city || '',
      addressState: ext.address_state || '',
      addressZip: ext.address_zip || '',
    })

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
          Upload a clear, full photo of a valid government-issued ID for each guest. We&apos;ll read the name and address directly from the ID.
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

            {/* Photo ID upload — always first */}
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
                    disabled={draft.uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(idx, file)
                    }}
                    className="block w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-secondary/10 file:text-secondary hover:file:bg-secondary/20 disabled:opacity-50"
                  />
                  {draft.uploading && (
                    <p className="text-xs text-on-surface-variant mt-1">Reading ID and checking quality…</p>
                  )}
                  {draft.error && (
                    <p className="text-xs text-error mt-1">{draft.error}</p>
                  )}
                </>
              )}
            </div>

            {/* Extracted info — shown after a successful upload */}
            {passed && (
              <div className="space-y-3 pt-1">
                <p className="text-on-surface-variant text-xs font-medium uppercase tracking-wide">Information read from ID</p>

                <div>
                  <label htmlFor={`guest-${idx}-name`} className="block text-on-surface-variant text-xs mb-1">Full Name</label>
                  <input
                    id={`guest-${idx}-name`}
                    type="text"
                    value={draft.name}
                    onChange={(e) => updateDraft(idx, { name: e.target.value })}
                    onBlur={() => saveAddress(idx)}
                    placeholder="As shown on ID"
                    className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-on-surface-variant text-xs">Current Address</label>
                  <PlacesAddressInput
                    value={draft.addressStreet}
                    onChange={(val) => updateDraft(idx, { addressStreet: val })}
                    onCityChange={(city) => updateDraft(idx, { addressCity: city })}
                    onStateChange={(state) => updateDraft(idx, { addressState: state })}
                    onZipChange={(zip) => updateDraft(idx, { addressZip: zip })}
                    onBlur={() => saveAddress(idx)}
                    placeholder="Street address"
                    className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      id={`guest-${idx}-city`}
                      type="text"
                      autoComplete="address-level2"
                      value={draft.addressCity}
                      onChange={(e) => updateDraft(idx, { addressCity: e.target.value })}
                      onBlur={() => saveAddress(idx)}
                      placeholder="City"
                      className="col-span-1 w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                    />
                    <input
                      id={`guest-${idx}-state`}
                      type="text"
                      autoComplete="address-level1"
                      value={draft.addressState}
                      onChange={(e) => updateDraft(idx, { addressState: e.target.value.toUpperCase().slice(0, 2) })}
                      onBlur={() => saveAddress(idx)}
                      placeholder="ST"
                      maxLength={2}
                      className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                    />
                    <input
                      id={`guest-${idx}-zip`}
                      type="text"
                      autoComplete="postal-code"
                      value={draft.addressZip}
                      onChange={(e) => updateDraft(idx, { addressZip: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      onBlur={() => saveAddress(idx)}
                      placeholder="ZIP"
                      className="w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-secondary/50"
                    />
                  </div>
                </div>
              </div>
            )}
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
