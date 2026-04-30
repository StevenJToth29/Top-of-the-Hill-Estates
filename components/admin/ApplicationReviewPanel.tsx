'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ApplicationRow } from '@/types'

interface Props {
  application: ApplicationRow
  onBack: () => void
  onDecision: (decidedId: string) => void
}

export default function ApplicationReviewPanel({ application, onBack, onDecision }: Props) {
  const router = useRouter()
  const [declining, setDeclining] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedPhoto, setExpandedPhoto] = useState<{ url: string; alt: string } | null>(null)

  const hoursLeft = application.application_deadline
    ? Math.max(0, Math.round((new Date(application.application_deadline).getTime() - Date.now()) / 3600000))
    : null

  async function decide(decision: 'approved' | 'declined') {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/bookings/${application.id}/application/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, decline_reason: decision === 'declined' ? declineReason : undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Request failed'); return }
      router.refresh()
      onDecision(application.id)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const app = application.application

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-on-surface-variant hover:text-on-surface text-sm">← Back to Applications</button>
        {hoursLeft !== null && hoursLeft <= 2 && (
          <span className="bg-error/10 border border-error/30 text-error text-xs font-bold px-2 py-0.5 rounded-full">⏰ {hoursLeft}h remaining</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-surface rounded-xl border border-outline p-5">
            <h3 className="font-semibold text-on-surface mb-4">Guest Identification</h3>
            {application.guest_id_documents.map((doc) => (
              <div key={doc.id} className={`border rounded-xl p-4 mb-3 ${doc.ai_authenticity_flag === 'flagged' || doc.ai_authenticity_flag === 'uncertain' ? 'border-warning/50 bg-warning/5' : 'border-outline'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm text-on-surface">Guest {doc.guest_index}{doc.guest_index === 1 ? ' (Primary)' : ''}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${doc.ai_authenticity_flag === 'clear' ? 'bg-secondary/10 text-secondary border border-secondary/30' : 'bg-warning/10 text-warning border border-warning/30'}`}>
                    {doc.ai_authenticity_flag === 'clear' ? '✓ AI Clear' : '⚠ AI Flag'}
                  </span>
                </div>
                <div className="space-y-3 text-sm mb-3">
                  <div><div className="text-on-surface-variant text-xs mb-1">Name</div><div className="text-on-surface">{doc.guest_name || '—'}</div></div>
                  <div><div className="text-on-surface-variant text-xs mb-1">Address</div><div className="text-on-surface break-words">{doc.current_address || '—'}</div></div>
                </div>
                <div className="mb-3">
                  <div className="text-on-surface-variant text-xs mb-1">ID Photo</div>
                  {doc.id_photo_signed_url ? (
                    <button
                      onClick={() => setExpandedPhoto({ url: doc.id_photo_signed_url!, alt: `Guest ${doc.guest_index} ID` })}
                      className="w-full focus:outline-none group"
                    >
                      <div className="relative">
                        <img
                          src={doc.id_photo_signed_url}
                          alt={`Guest ${doc.guest_index} ID`}
                          className="w-full max-h-64 object-contain rounded-lg border border-outline bg-black/20 group-hover:opacity-90 transition-opacity"
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full">Click to expand</span>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="rounded-lg border border-outline/50 bg-surface-highest/30 px-3 py-3 text-xs text-on-surface-variant italic">
                      {doc.id_photo_url ? 'Photo unavailable — guest must re-upload ID' : 'No photo uploaded'}
                    </div>
                  )}
                </div>
                {doc.ai_validation_notes && (
                  <div className={`text-xs rounded-lg px-3 py-2 ${doc.ai_authenticity_flag === 'clear' ? 'bg-secondary/10 text-secondary' : 'bg-warning/10 text-warning'}`}>
                    🤖 {doc.ai_validation_notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          {app && (
            <div className="bg-surface rounded-xl border border-outline p-5">
              <h3 className="font-semibold text-on-surface mb-4">Screening Questions</h3>
              {([['1. Purpose of stay', app.purpose_of_stay], ['2. Traveling from', app.traveling_from], ['3. Shared living experience', app.shared_living_exp]] as [string, string | undefined][]).map(([q, a]) => (
                <div key={q} className="mb-4">
                  <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">{q}</div>
                  <div className="bg-surface-highest/40 rounded-lg px-3 py-2 text-sm text-on-surface">{a || '—'}</div>
                </div>
              ))}
              <div className="mb-4">
                <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">4. House rules confirmed</div>
                <div className="flex items-center gap-2 text-sm">
                  {app.house_rules_confirmed ? <><span className="text-secondary">✓</span><span>Confirmed</span></> : <><span className="text-error">✗</span><span>Not confirmed</span></>}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-1">5. Additional info</div>
                <div className="bg-surface-highest/40 rounded-lg px-3 py-2 text-sm text-on-surface">{app.additional_info || '—'}</div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-surface rounded-xl border border-outline p-5">
            <h3 className="font-semibold text-on-surface mb-3 text-sm">Booking Summary</h3>
            {([['Guest', `${application.guest_first_name} ${application.guest_last_name}`], ['Room', application.room?.name ?? '—'], ['Check-in', application.check_in], ['Check-out', application.check_out], ['Guests', String(application.guest_count)], ['Total', `$${application.total_amount.toFixed(2)}`]] as [string, string][]).map(([l, v]) => (
              <div key={l} className="flex justify-between py-2 border-b border-outline/50 last:border-0 text-sm">
                <span className="text-on-surface-variant">{l}</span>
                <span className="text-on-surface font-medium">{v}</span>
              </div>
            ))}
          </div>

          <div className="bg-surface rounded-xl border border-outline p-5">
            <h3 className="font-semibold text-on-surface mb-4 text-sm">Make a Decision</h3>
            {error && <p className="text-xs text-error bg-error/10 rounded-lg px-3 py-2 mb-3">{error}</p>}
            {!declining ? (
              <div className="space-y-2">
                <button onClick={() => decide('approved')} disabled={submitting} className="w-full bg-secondary text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50">✓ Approve Booking</button>
                <button onClick={() => setDeclining(true)} disabled={submitting} className="w-full border-2 border-error text-error rounded-xl py-3 font-semibold text-sm disabled:opacity-50">✗ Decline Booking</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-error mb-1">Decline reason (optional — sent to guest):</div>
                <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="e.g. We are unable to accommodate your request at this time…" className="w-full border border-error/40 rounded-xl px-3 py-2 text-sm bg-error/5 text-on-surface resize-none min-h-[80px] focus:outline-none" />
                <button onClick={() => decide('declined')} disabled={submitting} className="w-full bg-error text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50">
                  {submitting ? 'Processing…' : 'Confirm Decline & Release Hold'}
                </button>
                <button onClick={() => setDeclining(false)} className="w-full text-on-surface-variant text-sm py-2">Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {expandedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setExpandedPhoto(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setExpandedPhoto(null)}
              className="absolute -top-10 right-0 text-white text-sm font-medium hover:text-white/70 transition-colors"
            >
              ✕ Close
            </button>
            <img
              src={expandedPhoto.url}
              alt={expandedPhoto.alt}
              className="w-full max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
