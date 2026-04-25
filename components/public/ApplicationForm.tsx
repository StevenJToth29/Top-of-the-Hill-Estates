'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import IdUploadStep from '@/components/public/IdUploadStep'
import ScreeningQuestionsStep from '@/components/public/ScreeningQuestionsStep'
import type { Booking, BookingApplication, GuestIdDocument } from '@/types'

interface ApplicationFormProps {
  booking: Booking & { room: { name: string; property: { name: string; house_rules?: string | null } } }
  application: BookingApplication | null
  savedDocs: GuestIdDocument[]
}

type Step = 'ids' | 'questions' | 'submit'

export default function ApplicationForm({ booking, application, savedDocs }: ApplicationFormProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('ids')
  const [idDocs, setIdDocs] = useState<GuestIdDocument[]>(savedDocs)
  const [questionFields, setQuestionFields] = useState<Partial<BookingApplication>>(application ?? {})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allIdsPassed = idDocs.filter((d) => d.ai_quality_result === 'pass').length >= (booking.guest_count ?? 1)

  const questionsComplete =
    !!questionFields.purpose_of_stay?.trim() &&
    !!questionFields.traveling_from?.trim() &&
    !!questionFields.shared_living_exp?.trim() &&
    !!questionFields.house_rules_confirmed

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/application`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...questionFields, submit: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Submission failed. Please try again.')
        return
      }
      router.push(`/booking/manage?booking_id=${booking.id}&guest_email=${encodeURIComponent(booking.guest_email)}`)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'ids', label: 'Guest IDs' },
    { key: 'questions', label: 'Questions' },
    { key: 'submit', label: 'Submit' },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="font-display text-2xl font-bold text-on-surface">Complete Your Application</h1>
        <p className="text-on-surface-variant text-sm">
          Your payment is on hold — you will only be charged if your booking is approved.
        </p>
        <div className="inline-flex items-center gap-1 bg-warning/10 border border-warning/30 text-warning text-xs font-semibold px-3 py-1.5 rounded-full">
          ⏳ Hold Active — Not Charged Yet
        </div>
      </div>

      <div className="bg-surface-highest/40 rounded-xl px-5 py-4 flex justify-between items-center text-sm">
        <div>
          <div className="font-semibold text-on-surface">{booking.room.name}</div>
          <div className="text-on-surface-variant">{booking.check_in} – {booking.check_out} · {booking.guest_count} guest{(booking.guest_count ?? 1) > 1 ? 's' : ''}</div>
        </div>
        <div className="font-bold text-on-surface">${booking.total_amount.toFixed(2)}</div>
      </div>

      <div className="flex items-center justify-center gap-0">
        {steps.map((s, i) => {
          const stepIndex = steps.findIndex((x) => x.key === step)
          const done = i < stepIndex
          const active = step === s.key
          return (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${done ? 'bg-secondary text-white' : active ? 'bg-primary text-white' : 'bg-surface-highest/60 text-on-surface-variant'}`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-xs whitespace-nowrap ${active ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-12 h-0.5 mb-5 ${done ? 'bg-secondary' : 'bg-surface-highest/60'}`} />
              )}
            </div>
          )
        })}
      </div>

      {step === 'ids' && (
        <>
          <IdUploadStep
            bookingId={booking.id}
            guestCount={booking.guest_count ?? 1}
            savedDocs={idDocs}
            onAllPassed={(docs) => setIdDocs(docs)}
          />
          <button onClick={() => setStep('questions')} disabled={!allIdsPassed} className="w-full bg-primary text-on-primary rounded-xl py-4 font-semibold disabled:opacity-40">
            Next: Screening Questions →
          </button>
        </>
      )}

      {step === 'questions' && (
        <>
          <ScreeningQuestionsStep bookingId={booking.id} saved={questionFields} houseRules={booking.room.property.house_rules ?? ''} onChange={setQuestionFields} />
          <div className="flex gap-3">
            <button onClick={() => setStep('ids')} className="flex-1 border border-outline rounded-xl py-4 font-semibold text-on-surface-variant">← Back</button>
            <button onClick={() => setStep('submit')} disabled={!questionsComplete} className="flex-[2] bg-primary text-on-primary rounded-xl py-4 font-semibold disabled:opacity-40">Review & Submit →</button>
          </div>
        </>
      )}

      {step === 'submit' && (
        <div className="space-y-6">
          <div className="bg-surface-highest/40 rounded-xl p-5 space-y-3 text-sm">
            <h3 className="font-semibold text-on-surface">Ready to submit</h3>
            <p className="text-on-surface-variant">{idDocs.filter((d) => d.ai_quality_result === 'pass').length} of {booking.guest_count ?? 1} ID{(booking.guest_count ?? 1) > 1 ? 's' : ''} verified ✓</p>
            <p className="text-on-surface-variant">All screening questions answered ✓</p>
          </div>
          {error && <p className="text-sm text-error bg-error/10 rounded-xl px-4 py-3">{error}</p>}
          <button onClick={() => setStep('questions')} className="w-full border border-outline rounded-xl py-3 font-semibold text-on-surface-variant text-sm">← Edit Answers</button>
          <button onClick={handleSubmit} disabled={submitting} className="w-full bg-primary text-on-primary rounded-xl py-4 font-semibold disabled:opacity-60">
            {submitting ? 'Submitting…' : 'Submit Application'}
          </button>
          <p className="text-center text-xs text-on-surface-variant">
            After submitting, your booking will be reviewed within 24 hours. You will receive an email with the decision.
          </p>
        </div>
      )}
    </div>
  )
}
