'use client'

import { usePathname, useRouter } from 'next/navigation'

const tabs = [
  { label: 'Settings', href: '/admin/email/settings' },
  { label: 'Templates', href: '/admin/email/templates' },
  { label: 'Automations', href: '/admin/email/automations' },
]

export default function EmailSubNav() {
  const pathname = usePathname()
  const router = useRouter()

  function navigate(href: string) {
    router.push(href)
    router.refresh()
  }

  return (
    <nav className="flex gap-1 border-b border-white/10 mb-8">
      {tabs.map(({ label, href }) => {
        const active = pathname.startsWith(href)
        return (
          <button
            key={href}
            type="button"
            onClick={() => navigate(href)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {label}
          </button>
        )
      })}
    </nav>
  )
}
