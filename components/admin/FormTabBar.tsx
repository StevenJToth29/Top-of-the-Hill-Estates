'use client'

interface Tab {
  id: string
  label: string
  icon?: string
  badge?: number | null
  warn?: boolean
}

interface FormTabBarProps {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
}

export default function FormTabBar({ tabs, active, onChange }: FormTabBarProps) {
  return (
    <div className="flex border-b-2 border-outline-variant/30 overflow-hidden shrink-0">
      {tabs.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-0.5 transition-all ${
              isActive
                ? 'text-secondary border-secondary bg-secondary/5'
                : 'text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container/30'
            }`}
          >
            {t.icon && <span className="text-base leading-none">{t.icon}</span>}
            {t.label}
            {t.warn && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
            {t.badge != null && t.badge > 0 && (
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  isActive
                    ? 'bg-secondary/10 text-secondary'
                    : 'bg-surface-high text-on-surface-variant/60'
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
