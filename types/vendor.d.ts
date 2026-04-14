// Ambient module declarations for packages with missing type files.
// These are needed because the installed packages have an incomplete type file set.

// date-fns subpath modules
declare module 'date-fns/parseISO' {
  export function parseISO(dateString: string): Date
}

declare module 'date-fns/differenceInHours' {
  export function differenceInHours(
    dateLeft: Date | number,
    dateRight: Date | number,
  ): number
}

// @heroicons/react individual icon modules
declare module '@heroicons/react/24/outline/ChartBarIcon' {
  import * as React from 'react'
  const ChartBarIcon: React.ForwardRefExoticComponent<
    React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> & {
      title?: string
      titleId?: string
    } & React.RefAttributes<SVGSVGElement>
  >
  export default ChartBarIcon
}

declare module '@heroicons/react/24/outline/CurrencyDollarIcon' {
  import * as React from 'react'
  const CurrencyDollarIcon: React.ForwardRefExoticComponent<
    React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> & {
      title?: string
      titleId?: string
    } & React.RefAttributes<SVGSVGElement>
  >
  export default CurrencyDollarIcon
}

declare module '@heroicons/react/24/outline/HomeIcon' {
  import * as React from 'react'
  const HomeIcon: React.ForwardRefExoticComponent<
    React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> & {
      title?: string
      titleId?: string
    } & React.RefAttributes<SVGSVGElement>
  >
  export default HomeIcon
}

declare module '@heroicons/react/24/outline/CheckCircleIcon' {
  import * as React from 'react'
  const CheckCircleIcon: React.ForwardRefExoticComponent<
    React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> & {
      title?: string
      titleId?: string
    } & React.RefAttributes<SVGSVGElement>
  >
  export default CheckCircleIcon
}
