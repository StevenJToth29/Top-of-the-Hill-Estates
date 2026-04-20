import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockRouter = { push: jest.fn(), back: jest.fn(), refresh: jest.fn() }

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

jest.mock('@tiptap/react', () => ({
  useEditor: jest.fn(() => ({
    chain: jest.fn(() => ({
      focus: jest.fn(() => ({
        toggleBold: jest.fn(() => ({ run: jest.fn() })),
        toggleItalic: jest.fn(() => ({ run: jest.fn() })),
        toggleUnderline: jest.fn(() => ({ run: jest.fn() })),
        toggleBulletList: jest.fn(() => ({ run: jest.fn() })),
        insertContent: jest.fn(() => ({ run: jest.fn() })),
      })),
    })),
    isActive: jest.fn(() => false),
    getHTML: jest.fn(() => '<p>Body content</p>'),
  })),
  EditorContent: () => React.createElement('div', { 'data-testid': 'editor-content' }),
}))

jest.mock('@tiptap/starter-kit', () => ({ __esModule: true, default: {} }))
jest.mock('@tiptap/extension-underline', () => ({
  __esModule: true,
  default: { configure: jest.fn(() => ({})) },
}))
jest.mock('@tiptap/extension-link', () => ({
  __esModule: true,
  default: { configure: jest.fn(() => ({})) },
}))
jest.mock('@/components/admin/email/VariableNode', () => ({ VariableNode: {} }))
jest.mock('@heroicons/react/24/outline', () => ({
  ChevronDownIcon: () => React.createElement('span'),
}))
jest.mock('@/lib/email', () => ({
  resolveVariables: (text: string, vars: Record<string, string>) =>
    text.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => vars[k] ?? ''),
}))

import EmailTemplateEditor from '@/components/admin/email/EmailTemplateEditor'
import type { EmailTemplate } from '@/types'

const template: EmailTemplate = {
  id: 'tmpl-1',
  name: 'Booking Confirmation',
  subject: 'Your booking is confirmed!',
  body: '<p>Hello {{guest_first_name}}</p>',
  is_active: true,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
}

describe('EmailTemplateEditor', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
    jest.clearAllMocks()
  })

  it('renders existing template values', () => {
    render(<EmailTemplateEditor template={template} />)
    expect(screen.getByDisplayValue('Booking Confirmation')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Your booking is confirmed!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save template/i })).toBeInTheDocument()
  })

  it('renders empty form for new template', () => {
    render(<EmailTemplateEditor template={null} />)
    expect(screen.getByRole('button', { name: /create template/i })).toBeInTheDocument()
  })

  it('shows validation error when name is empty on submit', async () => {
    render(<EmailTemplateEditor template={null} />)
    await userEvent.click(screen.getByRole('button', { name: /create template/i }))
    expect(screen.getByText(/name and subject are required/i)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls POST for new template', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new-id', ...template }),
    })
    render(<EmailTemplateEditor template={null} />)
    await userEvent.type(screen.getByPlaceholderText(/e\.g\. booking/i), 'My Template')
    await userEvent.type(screen.getByPlaceholderText(/your booking is confirmed/i), 'The subject')
    await userEvent.click(screen.getByRole('button', { name: /create template/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/email/templates',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('calls PUT for existing template', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => template,
    })
    render(<EmailTemplateEditor template={template} />)
    await userEvent.click(screen.getByRole('button', { name: /save template/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/admin/email/templates/${template.id}`,
        expect.objectContaining({ method: 'PUT' }),
      )
    })
  })

  it('shows preview when Show Preview clicked', async () => {
    render(<EmailTemplateEditor template={template} />)
    await userEvent.click(screen.getByRole('button', { name: /show preview/i }))
    expect(screen.getByText(/hide preview/i)).toBeInTheDocument()
  })
})
