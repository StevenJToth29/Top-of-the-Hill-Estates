import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PrePlannedAutomationsTab from '@/components/admin/email/PrePlannedAutomationsTab'
import type { EmailAutomation, EmailTemplate } from '@/types'

const automations: EmailAutomation[] = [
  {
    id: 'a1',
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
  {
    id: 'a2',
    name: 'Admin — New Booking',
    trigger_event: 'admin_new_booking',
    is_active: false,
    delay_minutes: 0,
    conditions: { operator: 'AND', rules: [] },
    template_id: null,
    recipient_type: 'admin',
    is_pre_planned: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
]

const templates: EmailTemplate[] = [
  {
    id: 't1',
    name: 'Confirmation Email',
    subject: 'Confirmed!',
    body: '',
    is_active: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
]

describe('PrePlannedAutomationsTab', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('renders automation names', () => {
    render(<PrePlannedAutomationsTab automations={automations} templates={templates} />)
    expect(screen.getByText('Booking Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Admin — New Booking')).toBeInTheDocument()
  })

  it('renders recipient type badges', () => {
    render(<PrePlannedAutomationsTab automations={automations} templates={templates} />)
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('calls PUT when toggle is clicked', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })
    render(<PrePlannedAutomationsTab automations={automations} templates={templates} />)
    await userEvent.click(screen.getByLabelText('Toggle Booking Confirmed'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/email/automations/a1',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"is_active":false'),
        }),
      )
    })
  })

  it('calls PUT when template is selected', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })
    render(<PrePlannedAutomationsTab automations={automations} templates={templates} />)
    const selects = screen.getAllByRole('combobox')
    await userEvent.selectOptions(selects[0], 't1')
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/email/automations/a1',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"template_id":"t1"'),
        }),
      )
    })
  })
})
