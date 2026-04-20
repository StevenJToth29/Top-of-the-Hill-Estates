import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomAutomationsTab from '@/components/admin/email/CustomAutomationsTab'
import type { EmailAutomation, EmailTemplate } from '@/types'

jest.mock('@heroicons/react/24/outline', () => ({
  PlusIcon: () => React.createElement('span', { 'data-testid': 'plus-icon' }),
  PencilIcon: () => React.createElement('span', { 'data-testid': 'pencil-icon' }),
  TrashIcon: () => React.createElement('span', { 'data-testid': 'trash-icon' }),
  ChevronDownIcon: () => React.createElement('span'),
  XMarkIcon: () => React.createElement('span'),
}))

jest.mock('@/components/admin/email/ConditionBuilder', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'condition-builder' }),
}))

const templates: EmailTemplate[] = [
  {
    id: 't1',
    name: 'My Template',
    subject: 'Hello',
    body: '',
    is_active: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
]

const custom: EmailAutomation = {
  id: 'ca1',
  name: 'Long Stay Follow-up',
  trigger_event: 'post_checkout',
  is_active: true,
  delay_minutes: 1440,
  conditions: { operator: 'AND', rules: [] },
  template_id: 't1',
  recipient_type: 'guest',
  is_pre_planned: false,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
}

describe('CustomAutomationsTab', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
    jest.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('shows empty state when no automations', () => {
    render(<CustomAutomationsTab automations={[]} templates={templates} />)
    expect(screen.getByText(/no custom automations/i)).toBeInTheDocument()
  })

  it('renders custom automation names', () => {
    render(<CustomAutomationsTab automations={[custom]} templates={templates} />)
    expect(screen.getByText('Long Stay Follow-up')).toBeInTheDocument()
  })

  it('opens builder form when New Automation clicked', async () => {
    render(<CustomAutomationsTab automations={[]} templates={templates} />)
    await userEvent.click(screen.getByRole('button', { name: /new automation/i }))
    expect(screen.getByLabelText(/automation name/i)).toBeInTheDocument()
  })

  it('calls POST on save', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...custom, id: 'new-id' }),
    })
    render(<CustomAutomationsTab automations={[]} templates={templates} />)
    await userEvent.click(screen.getByRole('button', { name: /new automation/i }))
    await userEvent.type(screen.getByLabelText(/automation name/i), 'Test Automation')
    await userEvent.click(screen.getByRole('button', { name: /save automation/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/email/automations',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('calls DELETE and removes automation', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })
    render(<CustomAutomationsTab automations={[custom]} templates={templates} />)
    await userEvent.click(screen.getByTestId('trash-icon').closest('button')!)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/email/automations/ca1',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
    expect(screen.queryByText('Long Stay Follow-up')).not.toBeInTheDocument()
  })

  it('prefills form when Edit is clicked', async () => {
    render(<CustomAutomationsTab automations={[custom]} templates={templates} />)
    await userEvent.click(screen.getByTestId('pencil-icon').closest('button')!)
    expect(screen.getByDisplayValue('Long Stay Follow-up')).toBeInTheDocument()
  })
})
