'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Cog6ToothIcon, DocumentTextIcon, BoltIcon } from '@heroicons/react/24/outline'

const tabs = [
  { label: 'Settings', href: '/admin/email/settings', Icon: Cog6ToothIcon },
  { label: 'Templates', href: '/admin/email/templates', Icon: DocumentTextIcon },
  { label: 'Automations', href: '/admin/email/automations', Icon: BoltIcon },
]

export default function EmailSubNav() {
  const pathname = usePathname()
  const router = useRouter()

  function navigate(href: string) {
    router.push(href)
    router.refresh()
  }

  return (
    <nav className="flex gap-0 border-b-2 border-slate-200 mb-8">
      {tabs.map(({ label, href, Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <button
            key={href}
            type="button"
            onClick={() => navigate(href)}
            className={`px-5 py-2.5 rounded-t-lg text-sm font-semibold font-body inline-flex items-center gap-1.5 border-b-2 -mb-0.5 transition-colors ${
              active
                ? 'bg-white text-teal-600 border-teal-400'
                : 'bg-transparent text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
