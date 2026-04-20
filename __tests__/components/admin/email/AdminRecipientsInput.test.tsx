import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminRecipientsInput from '@/components/admin/email/AdminRecipientsInput'

jest.mock('@heroicons/react/24/outline', () => ({
  XMarkIcon: () => React.createElement('span', { 'data-testid': 'x-icon' }),
}))

describe('AdminRecipientsInput', () => {
  it('renders existing emails as chips', () => {
    render(<AdminRecipientsInput value={['a@b.com', 'c@d.com']} onChange={jest.fn()} />)
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByText('c@d.com')).toBeInTheDocument()
  })

  it('adds email on Enter', async () => {
    const onChange = jest.fn()
    render(<AdminRecipientsInput value={[]} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add email/i)
    await userEvent.type(input, 'new@example.com')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['new@example.com'])
  })

  it('removes email on × click', async () => {
    const onChange = jest.fn()
    render(<AdminRecipientsInput value={['a@b.com']} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Remove a@b.com'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('does not add duplicate email', async () => {
    const onChange = jest.fn()
    render(<AdminRecipientsInput value={['a@b.com']} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add email/i)
    await userEvent.type(input, 'a@b.com')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not add empty string', async () => {
    const onChange = jest.fn()
    render(<AdminRecipientsInput value={[]} onChange={onChange} />)
    const input = screen.getByPlaceholderText(/add email/i)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
