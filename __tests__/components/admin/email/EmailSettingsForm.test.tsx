import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmailSettingsForm from '@/components/admin/email/EmailSettingsForm'
import type { EmailSettings } from '@/types'

jest.mock('@heroicons/react/24/outline', () => ({
  XMarkIcon: () => React.createElement('span', { 'data-testid': 'x-icon' }),
}))

const base: EmailSettings = {
  id: 's1',
  from_name: 'Top of the Hill',
  from_email: 'noreply@test.com',
  admin_recipients: ['admin@test.com'],
  review_url: 'https://example.com/review',
}

describe('EmailSettingsForm', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  it('renders all fields with initial values', () => {
    render(<EmailSettingsForm settings={base} />)
    expect(screen.getByDisplayValue('Top of the Hill')).toBeInTheDocument()
    expect(screen.getByDisplayValue('noreply@test.com')).toBeInTheDocument()
    expect(screen.getByText('admin@test.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://example.com/review')).toBeInTheDocument()
  })

  it('calls PUT /api/admin/email/settings on save', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => base,
    })
    render(<EmailSettingsForm settings={base} />)
    await userEvent.click(screen.getByRole('button', { name: /save settings/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/email/settings',
        expect.objectContaining({ method: 'PUT' }),
      )
    })
  })

  it('shows Saved! on success', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => base,
    })
    render(<EmailSettingsForm settings={base} />)
    await userEvent.click(screen.getByRole('button', { name: /save settings/i }))
    await waitFor(() => expect(screen.getByText('Saved!')).toBeInTheDocument())
  })

  it('shows error message on failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed to save settings' }),
    })
    render(<EmailSettingsForm settings={base} />)
    await userEvent.click(screen.getByRole('button', { name: /save settings/i }))
    await waitFor(() =>
      expect(screen.getByText('Failed to save settings')).toBeInTheDocument(),
    )
  })
})
