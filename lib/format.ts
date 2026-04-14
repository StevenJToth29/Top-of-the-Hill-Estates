import { format, parseISO } from 'date-fns'
import type { BookingStatus } from '@/types'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount)
}

export function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy')
  } catch {
    return iso
  }
}

export function formatDateTime(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy h:mm a')
  } catch {
    return iso
  }
}

export const STATUS_BADGE: Record<BookingStatus, string> = {
  pending: 'bg-surface-container text-on-surface-variant',
  confirmed: 'bg-secondary/20 text-secondary',
  cancelled: 'bg-error/20 text-error',
  completed: 'bg-primary/20 text-primary',
}
