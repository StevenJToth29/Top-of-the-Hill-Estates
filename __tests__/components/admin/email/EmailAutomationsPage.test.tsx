import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmailAutomationsPage from '@/components/admin/email/EmailAutomationsPage'
import type { EmailAutomation, EmailTemplate } from '@/types'

jest.mock('@/components/admin/email/PrePlannedAutomationsTab', () => ({
  __esModule: true,
  default: () =>
    React.createElement('div', { 'data-testid': 'pre-planned-tab' }, 'Pre-Planned Content'),
}))

jest.mock('@/components/admin/email/CustomAutomationsTab', () => ({
  __esModule: true,
  default: () =>
    React.createElement('div', { 'data-testid': 'custom-tab' }, 'Custom Content'),
}))

const prePlanned: EmailAutomation[] = [
  {
    id: 'p1',
    name: 'Booking Confirmed',
    trigger_event: 'booking_confirmed',
    is_active: true,
    delay_minutes: 0,
    conditions: { operator: 'AND', rules: [] },
    template_id: null,
    recipient_type: 'guest',
    is_pre_planned: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
]

const custom: EmailAutomation[] = [
  {
    id: 'c1',
    name: 'Long Stay',
    trigger_event: 'post_checkout',
    is_active: true,
    delay_minutes: 0,
    conditions: { operator: 'AND', rules: [] },
    template_id: null,
    recipient_type: 'guest',
    is_pre_planned: false,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
]

const templates: EmailTemplate[] = []

describe('EmailAutomationsPage', () => {
  it('renders Pre-Planned tab by default', () => {
    render(
      <EmailAutomationsPage
        automations={[...prePlanned, ...custom]}
        templates={templates}
      />,
    )
    expect(screen.getByTestId('pre-planned-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('custom-tab')).not.toBeInTheDocument()
  })

  it('switches to Custom tab on click', async () => {
    render(
      <EmailAutomationsPage
        automations={[...prePlanned, ...custom]}
        templates={templates}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /custom/i }))
    expect(screen.getByTestId('custom-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('pre-planned-tab')).not.toBeInTheDocument()
  })

  it('switches back to Pre-Planned tab on click', async () => {
    render(
      <EmailAutomationsPage
        automations={[...prePlanned, ...custom]}
        templates={templates}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /custom/i }))
    await userEvent.click(screen.getByRole('button', { name: /pre-planned/i }))
    expect(screen.getByTestId('pre-planned-tab')).toBeInTheDocument()
    expect(screen.queryByTestId('custom-tab')).not.toBeInTheDocument()
  })
})
