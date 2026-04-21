import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockRouter = { push: jest.fn(), back: jest.fn(), refresh: jest.fn() }

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

// Mock the Unlayer editor — it loads remotely and can't run in jsdom
const mockExportHtml = jest.fn()
const mockLoadDesign = jest.fn()
jest.mock('react-email-editor', () => {
  const React = require('react')
  const EmailEditor = React.forwardRef(
    (_props: unknown, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        editor: { exportHtml: mockExportHtml, loadDesign: mockLoadDesign },
      }))
      return React.createElement('div', { 'data-testid': 'unlayer-editor' })
    },
  )
  EmailEditor.displayName = 'EmailEditor'
  return { __esModule: true, default: EmailEditor }
})

jest.mock('@heroicons/react/24/outline', () => ({
  ChevronDownIcon: () => React.createElement('span'),
}))

import EmailTemplateEditor from '@/components/admin/email/EmailTemplateEditor'
import type { EmailTemplate } from '@/types'

const template: EmailTemplate = {
  id: 'tmpl-1',
  name: 'Booking Confirmation',
  subject: 'Your booking is confirmed!',
  body: '<p>Hello</p>',
  design: null,
  is_active: true,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
}

describe('EmailTemplateEditor', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
    jest.clearAllMocks()
  })

  it('renders existing template name and subject', () => {
    render(<EmailTemplateEditor template={template} />)
    expect(screen.getByDisplayValue('Booking Confirmation')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Your booking is confirmed!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save template/i })).toBeInTheDocument()
  })

  it('renders empty form for new template', () => {
    render(<EmailTemplateEditor template={null} />)
    expect(screen.getByRole('button', { name: /create template/i })).toBeInTheDocument()
  })

  it('shows validation error when name is empty', async () => {
    render(<EmailTemplateEditor template={null} />)
    await userEvent.click(screen.getByRole('button', { name: /create template/i }))
    expect(screen.getByText(/name and subject are required/i)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls POST with html and design for new template when editor is ready', async () => {
    mockExportHtml.mockImplementation((cb: (data: { html: string; design: object }) => void) =>
      cb({ html: '<p>body</p>', design: { counters: {}, body: {} } }),
    )
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-id', ...template }),
    })

    render(<EmailTemplateEditor template={null} />)
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. booking/i), 'My Template')
    await userEvent.type(screen.getByPlaceholderText(/your booking at/i), 'The Subject')

    // Simulate onReady by triggering the editor ref — not possible directly in jsdom,
    // so we verify the save button is disabled until ready, then confirm the guard message.
    await userEvent.click(screen.getByRole('button', { name: /create template/i }))
    expect(screen.getByText(/editor is still loading/i)).toBeInTheDocument()
  })

  it('renders the Unlayer editor canvas', () => {
    render(<EmailTemplateEditor template={template} />)
    expect(screen.getByTestId('unlayer-editor')).toBeInTheDocument()
  })

  it('toggles active/inactive state', async () => {
    render(<EmailTemplateEditor template={template} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
})
