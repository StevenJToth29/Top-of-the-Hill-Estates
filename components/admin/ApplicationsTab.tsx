'use client'

import { useState, useEffect, useCallback } from 'react'
import ApplicationReviewPanel from '@/components/admin/ApplicationReviewPanel'

interface ApplicationRow {
  id: string
  status: string
  check_in: string
  check_out: string
  guest_count: number
  guest_first_name: string
  guest_last_name: string
  guest_email: string
  total_amount: number
  application_deadline: string | null
  stripe_payment_intent_id: string
  room: { name: string; property: { name: string } } | null
  application: { id: string; submitted_at: string | null; decision: string | null } | null
  guest_id_documents: { id: string; guest_index: number; ai_quality_result: string | null; ai_authenticity_flag: string | null }[]
}

function Countdown({ deadline }: { deadline: string | null }) {
  const [remaining, setRemaining] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [overdue, setOverdue] = useState(false)

  useEffect(() => {
    if (!deadline) { setRemaining('—'); return }
    function update() {
      const ms = new Date(deadline!).getTime() - Date.now()
      if (ms <= 0) { setOverdue(true); setUrgent(false); setRemaining('OVERDUE'); return }
      const h = Math.floor(ms / 3600000)
      const m = Math.floor((ms % 3600000) / 60000)
      setRemaining(`${h}h ${m}m`)
      setUrgent(ms < 8 * 3600000)
      setOverdue(false)
    }
    update()
    const t = setInterval(update, 60000)
    return () => clearInterval(t)
  }, [deadline])

  const cls = overdue ? 'text-error font-bold' : urgent ? 'text-warning font-semibold' : 'text-secondary'
  return <span className={cls}>{remaining}</span>
}

export default function ApplicationsTab() {
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ApplicationRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/applications')
      const data = await res.json()
      setApplications(data.applications ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function hasAiFlag(row: ApplicationRow) {
    return row.guest_id_documents.some(
      (d) => d.ai_authenticity_flag === 'flagged' || d.ai_authenticity_flag === 'uncertain'
    )
  }

  const overdueCount = applications.filter(
    (a) => a.application_deadline && new Date(a.application_deadline) < new Date()
  ).length

  if (selected) {
    return (
      <ApplicationReviewPanel
        application={selected}
        onBack={() => setSelected(null)}
        onDecision={() => { setSelected(null); load() }}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-on-surface">Pending Applications</h2>
          <span className="text-sm text-on-surface-variant">({applications.length})</span>
        </div>
        {overdueCount > 0 && (
          <span className="bg-error/10 border border-error/30 text-error text-xs font-bold px-3 py-1 rounded-full">
            ⚠ {overdueCount} Overdue
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-on-surface-variant text-sm py-8 text-center">Loading…</p>
      ) : applications.length === 0 ? (
        <p className="text-on-surface-variant text-sm py-12 text-center">No pending applications</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline">
                {['Guest', 'Room', 'Dates', 'Guests', 'AI Flags', 'Time Remaining', ''].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const isOverdue = !!(app.application_deadline && new Date(app.application_deadline) < new Date())
                return (
                  <tr
                    key={app.id}
                    className={`border-b border-outline/50 hover:bg-surface-highest/30 cursor-pointer ${isOverdue ? 'bg-error/5' : ''}`}
                    onClick={() => setSelected(app)}
                  >
                    <td className="py-3 px-3">
                      <div className="font-semibold text-on-surface">{app.guest_last_name}, {app.guest_first_name}</div>
                      <div className="text-on-surface-variant text-xs">{app.guest_email}</div>
                    </td>
                    <td className="py-3 px-3 text-on-surface">{app.room?.name ?? '—'}</td>
                    <td className="py-3 px-3 text-on-surface whitespace-nowrap">{app.check_in} – {app.check_out}</td>
                    <td className="py-3 px-3 text-on-surface">{app.guest_count}</td>
                    <td className="py-3 px-3">
                      {hasAiFlag(app) ? (
                        <span className="bg-warning/10 text-warning border border-warning/30 text-xs font-semibold px-2 py-0.5 rounded-full">⚠ Flag</span>
                      ) : (
                        <span className="bg-secondary/10 text-secondary border border-secondary/30 text-xs font-semibold px-2 py-0.5 rounded-full">✓ Clear</span>
                      )}
                    </td>
                    <td className="py-3 px-3"><Countdown deadline={app.application_deadline} /></td>
                    <td className="py-3 px-3">
                      <button className="bg-primary text-on-primary text-xs font-semibold px-3 py-1.5 rounded-lg">Review →</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
