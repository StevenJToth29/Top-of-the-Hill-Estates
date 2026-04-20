import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VariablePicker from '@/components/admin/email/VariablePicker'

jest.mock('@heroicons/react/24/outline', () => ({
  ChevronDownIcon: () => React.createElement('span'),
}))

describe('VariablePicker', () => {
  it('dropdown is closed by default', () => {
    render(<VariablePicker onSelect={jest.fn()} />)
    expect(screen.queryByText('Guest')).not.toBeInTheDocument()
  })

  it('opens dropdown on button click', async () => {
    render(<VariablePicker onSelect={jest.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /insert variable/i }))
    expect(screen.getByText('Guest')).toBeInTheDocument()
  })

  it('calls onSelect with the variable key and closes', async () => {
    const onSelect = jest.fn()
    render(<VariablePicker onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: /insert variable/i }))
    await userEvent.click(screen.getByText(/guest_first_name/))
    expect(onSelect).toHaveBeenCalledWith('guest_first_name')
    expect(screen.queryByText('Guest')).not.toBeInTheDocument()
  })

  it('shows all five variable groups', async () => {
    render(<VariablePicker onSelect={jest.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /insert variable/i }))
    expect(screen.getByText('Guest')).toBeInTheDocument()
    expect(screen.getByText('Booking')).toBeInTheDocument()
    expect(screen.getByText('Property')).toBeInTheDocument()
    expect(screen.getByText('Site')).toBeInTheDocument()
    expect(screen.getByText('Contact Form')).toBeInTheDocument()
  })

  it('accepts a custom buttonLabel', () => {
    render(<VariablePicker onSelect={jest.fn()} buttonLabel="Pick Var" />)
    expect(screen.getByRole('button', { name: /pick var/i })).toBeInTheDocument()
  })
})
