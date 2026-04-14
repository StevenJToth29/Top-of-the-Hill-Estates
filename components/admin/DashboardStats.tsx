import ChartBarIcon from '@heroicons/react/24/outline/ChartBarIcon'
import CurrencyDollarIcon from '@heroicons/react/24/outline/CurrencyDollarIcon'
import HomeIcon from '@heroicons/react/24/outline/HomeIcon'
import CheckCircleIcon from '@heroicons/react/24/outline/CheckCircleIcon'

interface DashboardStatsProps {
  totalBookings: number
  monthlyRevenue: number
  upcomingCheckins: number
  confirmedCount: number
}

interface StatCardProps {
  label: string
  value: string
  icon: React.ForwardRefExoticComponent<
    React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> & {
      title?: string
      titleId?: string
    } & React.RefAttributes<SVGSVGElement>
  >
  valueClass: string
}

function StatCard({ label, value, icon: Icon, valueClass }: StatCardProps) {
  return (
    <div className="bg-surface-highest/40 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_40px_rgba(45,212,191,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="uppercase tracking-widest text-xs text-on-surface-variant mb-3">
            {label}
          </p>
          <p className={`font-display text-3xl font-semibold truncate ${valueClass}`}>
            {value}
          </p>
        </div>
        <div className="shrink-0 mt-1">
          <Icon className="w-6 h-6 text-on-surface-variant" />
        </div>
      </div>
    </div>
  )
}

export function DashboardStats({
  totalBookings,
  monthlyRevenue,
  upcomingCheckins,
  confirmedCount,
}: DashboardStatsProps) {
  const stats: StatCardProps[] = [
    {
      label: 'Total Bookings',
      value: totalBookings.toLocaleString(),
      icon: ChartBarIcon,
      valueClass: 'text-primary',
    },
    {
      label: 'Revenue This Month',
      value: `$${monthlyRevenue.toLocaleString()}`,
      icon: CurrencyDollarIcon,
      valueClass: 'text-primary',
    },
    {
      label: 'Upcoming Check-ins',
      value: upcomingCheckins.toLocaleString(),
      icon: HomeIcon,
      valueClass: 'text-secondary',
    },
    {
      label: 'Confirmed Bookings',
      value: confirmedCount.toLocaleString(),
      icon: CheckCircleIcon,
      valueClass: 'text-on-surface',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  )
}
