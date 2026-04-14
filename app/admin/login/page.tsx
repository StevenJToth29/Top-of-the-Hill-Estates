'use client'

import { createClient } from '@/lib/supabase-browser'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import Image from 'next/image'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      const redirectTo = searchParams.get('redirectTo') ?? '/admin'
      router.push(redirectTo)
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block font-body text-sm font-medium text-on-surface-variant"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-outline-variant bg-surface/60 px-4 py-2.5 font-body text-sm text-on-surface placeholder-on-surface-variant/50 backdrop-blur-sm outline-none transition focus:border-secondary/60 focus:ring-2 focus:ring-secondary/20"
          placeholder="admin@example.com"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block font-body text-sm font-medium text-on-surface-variant"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-outline-variant bg-surface/60 px-4 py-2.5 font-body text-sm text-on-surface placeholder-on-surface-variant/50 backdrop-blur-sm outline-none transition focus:border-secondary/60 focus:ring-2 focus:ring-secondary/20"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="font-body text-sm text-error">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary px-4 py-2.5 font-display text-sm font-semibold text-background transition hover:bg-secondary active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}

export default function AdminLoginPage() {
  return (
    <div data-admin className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center flex flex-col items-center gap-3">
          <Image
            src="/logo.png"
            alt="Top of the Hill Rooms"
            width={64}
            height={64}
            className="rounded-2xl"
          />
          <div>
            <span className="font-display text-xl font-bold text-primary tracking-tight block">
              Top of the Hill Rooms
            </span>
            <p className="mt-1 font-body text-sm text-on-surface-variant">
              Admin Portal
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-surface-container/60 backdrop-blur-xl p-8 shadow-2xl">
          <h1 className="mb-6 font-display text-xl font-semibold text-on-surface">
            Sign in to your account
          </h1>
          <Suspense fallback={<div className="h-40" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
