import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EmailTemplatesList from '@/components/admin/email/EmailTemplatesList'
import type { EmailTemplate } from '@/types'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}))

jest.mock('@heroicons/react/24/outline', () => ({
  PencilIcon: () => React.createElement('span', { 'data-testid': 'pencil-icon' }),
  TrashIcon: () => React.createElement('span', { 'data-testid': 'trash-icon' }),
  MagnifyingGlassIcon: () => React.createElement('span'),
  PlusIcon: () => React.createElement('span'),
}))

const templates: EmailTemplate[] = [
  {
    id: 't1',
    name: 'Welcome Email',
    subject: 'Welcome!',
    body: '<p>Hi</p>',
    is_active: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: 't2',
    name: 'Reminder',
    subject: "Don't forget",
    body: '<p>Hey</p>',
    is_active: false,
    created_at: '2024-01-02',
    updated_at: '2024-01-02',
  },
]

describe('EmailTemplatesList', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
    jest.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('renders template names and subjects', () => {
    render(<EmailTemplatesList templates={templates} />)
    expect(screen.getByText('Welcome Email')).toBeInTheDocument()
    expect(screen.getByText('Welcome!')).toBeInTheDocument()
    expect(screen.getByText('Reminder')).toBeInTheDocument()
  })

  it('shows empty state when no templates', () => {
    render(<EmailTemplatesList templates={[]} />)
    expect(screen.getByText(/no templates yet/i)).toBeInTheDocument()
  })

  it('calls PUT to toggle active state', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })
    render(<EmailTemplatesList templates={templates} />)
    await userEvent.click(screen.getByLabelText('Deactivate Welcome Email'))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/email/templates/t1',
        expect.objectContaining({ method: 'PUT' }),
      )
    })
  })

  it('calls DELETE after confirm and removes from list', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })
    render(<EmailTemplatesList templates={templates} />)
    const trashBtns = screen.getAllByTestId('trash-icon')
    await userEvent.click(trashBtns[0].closest('button')!)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/email/templates/t1',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
    expect(screen.queryByText('Welcome Email')).not.toBeInTheDocument()
  })

  it('edit link points to template editor', () => {
    render(<EmailTemplatesList templates={templates} />)
    const editIcon = screen.getAllByTestId('pencil-icon')[0]
    expect(editIcon.closest('a')).toHaveAttribute('href', '/admin/email/templates/t1')
  })
})
