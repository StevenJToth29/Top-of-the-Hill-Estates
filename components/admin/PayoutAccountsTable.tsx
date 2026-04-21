'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { StripeAccount } from '@/types'

interface PayoutAccountsTableProps {
  accounts: StripeAccount[]
}

const inputClass =
  'w-full bg-surface-highest/40 rounded-xl px-4 py-3 text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-secondary/50'
const labelClass = 'block text-sm font-medium text-on-surface-variant mb-1.5'

export default function PayoutAccountsTable({ accounts: initial }: PayoutAccountsTableProps) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<StripeAccount[]>(initial)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openAdd() {
    setEditingId(null)
    setLabel('')
    setError(null)
    setShowForm(true)
  }

  function openEdit(account: StripeAccount) {
    setEditingId(account.id)
    setLabel(account.label)
    setError(null)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setLabel('')
    setError(null)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      try {
        const url = editingId
          ? `/api/admin/payout-accounts/${editingId}`
          : '/api/admin/payout-accounts'
        const method = editingId ? 'PATCH' : 'POST'

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Save failed')

        if (editingId) {
          setAccounts((prev) => prev.map((a) => (a.id === editingId ? data : a)))
          cancelForm()
        } else {
          cancelForm()
          router.push(`/admin/payout-accounts/${data.id}`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  function handleDelete(account: StripeAccount) {
    if (!confirm(`Delete "${account.label}"? This cannot be undone.`)) return
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/payout-accounts/${account.id}`, { method: 'DELETE' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Delete failed')
        setAccounts((prev) => prev.filter((a) => a.id !== account.id))
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={openAdd}
          disabled={isPending}
          className="bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-6 py-2.5 hover:opacity-90 transition-opacity text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Account
        </button>
      </div>

      {showForm && (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-on-surface">
            {editingId ? 'Rename Payout Account' : 'Add Payout Account'}
          </h3>
          <div>
            <label className={labelClass}>Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. House A Bank"
              className={inputClass}
            />
          </div>
          {!editingId && (
            <p className="text-xs text-on-surface-variant/60">
              A new Stripe connected account will be created automatically. You'll be taken to the onboarding page next.
            </p>
          )}
          {error && (
            <p className="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3">{error}</p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={cancelForm}
              className="px-5 py-2 rounded-xl text-sm text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || !label.trim()}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-xl px-6 py-2 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isPending ? (editingId ? 'Saving…' : 'Creating account…') : editingId ? 'Save' : 'Create & Set Up'}
            </button>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-8 text-center text-on-surface-variant">
          No payout accounts yet. Add one to start routing property payments.
        </div>
      ) : (
        <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant">
                <th className="text-left px-6 py-3 font-medium">Label</th>
                <th className="text-left px-6 py-3 font-medium">Stripe Account ID</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-outline-variant/50 last:border-0">
                  <td className="px-6 py-4 text-on-surface font-medium">{account.label}</td>
                  <td className="px-6 py-4 text-on-surface-variant font-mono text-xs">
                    {account.stripe_account_id}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-3 justify-end">
                      <a
                        href={`/admin/payout-accounts/${account.id}`}
                        className="text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        Manage
                      </a>
                      <button
                        onClick={() => openEdit(account)}
                        disabled={isPending}
                        className="text-xs text-secondary hover:text-secondary/80 transition-colors disabled:opacity-50"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDelete(account)}
                        disabled={isPending}
                        className="text-xs text-error hover:text-error/80 transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
