import Link from 'next/link'
import { CheckCircleIcon } from '@heroicons/react/24/outline'

export default function ApplyConfirmationPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <CheckCircleIcon className="w-16 h-16 text-secondary" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-on-surface">
            We&apos;ve received your inquiry
          </h1>
          <p className="text-on-surface-variant leading-relaxed">
            Thank you for your interest. Someone from our team will be in touch with you shortly
            to discuss next steps.
          </p>
        </div>
        <Link
          href="/"
          className="inline-block bg-gradient-to-r from-primary to-secondary text-background font-semibold rounded-2xl px-8 py-3 hover:opacity-90 transition-opacity"
        >
          Back to Home
        </Link>
      </div>
    </main>
  )
}
