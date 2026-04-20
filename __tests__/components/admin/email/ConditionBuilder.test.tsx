import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConditionBuilder from '@/components/admin/email/ConditionBuilder'
import type { ConditionBlock } from '@/types'

const empty: ConditionBlock = { operator: 'AND', rules: [] }

const twoRules: ConditionBlock = {
  operator: 'AND',
  rules: [
    { field: 'booking_type', op: 'eq', value: 'long_term' },
    { field: 'total_nights', op: 'gte', value: 7 },
  ],
}

describe('ConditionBuilder', () => {
  it('renders empty with add button and no AND/OR toggle', () => {
    render(<ConditionBuilder value={empty} onChange={jest.fn()} />)
    expect(screen.getByRole('button', { name: /add condition/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'AND' })).not.toBeInTheDocument()
  })

  it('calls onChange with a new rule on add', async () => {
    const onChange = jest.fn()
    render(<ConditionBuilder value={empty} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /add condition/i }))
    expect(onChange).toHaveBeenCalledWith({
      operator: 'AND',
      rules: [{ field: 'booking_type', op: 'eq', value: '' }],
    })
  })

  it('removes a rule when remove button clicked', async () => {
    const onChange = jest.fn()
    const oneRule: ConditionBlock = {
      operator: 'AND',
      rules: [{ field: 'booking_type', op: 'eq', value: 'long_term' }],
    }
    render(<ConditionBuilder value={oneRule} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /remove condition/i }))
    expect(onChange).toHaveBeenCalledWith({ operator: 'AND', rules: [] })
  })

  it('shows AND/OR toggle when there are 2+ rules', () => {
    render(<ConditionBuilder value={twoRules} onChange={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'AND' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OR' })).toBeInTheDocument()
  })

  it('changes operator when OR is clicked', async () => {
    const onChange = jest.fn()
    render(<ConditionBuilder value={twoRules} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'OR' }))
    expect(onChange).toHaveBeenCalledWith({ ...twoRules, operator: 'OR' })
  })

  it('updates a rule field when select changes', async () => {
    const onChange = jest.fn()
    const oneRule: ConditionBlock = {
      operator: 'AND',
      rules: [{ field: 'booking_type', op: 'eq', value: '' }],
    }
    render(<ConditionBuilder value={oneRule} onChange={onChange} />)
    const fieldSelect = screen.getAllByRole('combobox')[0]
    await userEvent.selectOptions(fieldSelect, 'total_nights')
    expect(onChange).toHaveBeenCalledWith({
      operator: 'AND',
      rules: [{ field: 'total_nights', op: 'eq', value: '' }],
    })
  })
})
