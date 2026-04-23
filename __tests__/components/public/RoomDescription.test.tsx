import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import RoomDescription from '@/components/public/RoomDescription'

describe('RoomDescription', () => {
  it('renders nothing when all props are null', () => {
    const { container } = render(
      <RoomDescription description={null} propertyDescription={null} houseRules={null} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders room description when provided', () => {
    render(<RoomDescription description="Cozy studio" propertyDescription={null} houseRules={null} />)
    expect(screen.getByText('Cozy studio')).toBeInTheDocument()
  })

  it('renders property description when provided', () => {
    render(<RoomDescription description={null} propertyDescription="Great property" houseRules={null} />)
    expect(screen.getByText('Great property')).toBeInTheDocument()
  })

  it('renders both descriptions when both are provided', () => {
    render(
      <RoomDescription
        description="Room description"
        propertyDescription="Property description"
        houseRules={null}
      />,
    )
    expect(screen.getByText('Room description')).toBeInTheDocument()
    expect(screen.getByText('Property description')).toBeInTheDocument()
  })

  it('property description appears after room description in the DOM', () => {
    render(
      <RoomDescription
        description="Room first"
        propertyDescription="Property second"
        houseRules={null}
      />,
    )
    const paragraphs = screen.getAllByText(/Room first|Property second/)
    expect(paragraphs[0]).toHaveTextContent('Room first')
    expect(paragraphs[1]).toHaveTextContent('Property second')
  })

  it('does not show house rules initially when houseRules is provided', () => {
    render(
      <RoomDescription description="Room" propertyDescription={null} houseRules="No smoking" />,
    )
    expect(screen.queryByText('No smoking')).not.toBeInTheDocument()
    expect(screen.getByText('Read more ↓')).toBeInTheDocument()
  })

  it('expands to show house rules when Read more is clicked', () => {
    render(
      <RoomDescription description="Room" propertyDescription={null} houseRules="No smoking" />,
    )
    fireEvent.click(screen.getByText('Read more ↓'))
    expect(screen.getByText('No smoking')).toBeInTheDocument()
    expect(screen.getByText('Show less ↑')).toBeInTheDocument()
  })

  it('collapses house rules when Show less is clicked', () => {
    render(
      <RoomDescription description="Room" propertyDescription={null} houseRules="No smoking" />,
    )
    fireEvent.click(screen.getByText('Read more ↓'))
    fireEvent.click(screen.getByText('Show less ↑'))
    expect(screen.queryByText('No smoking')).not.toBeInTheDocument()
  })

  it('renders with only property description and house rules (no room description)', () => {
    render(
      <RoomDescription
        description={null}
        propertyDescription="Nice area"
        houseRules="No parties"
      />,
    )
    expect(screen.getByText('Nice area')).toBeInTheDocument()
    expect(screen.getByText('Read more ↓')).toBeInTheDocument()
  })

  it('omits propertyDescription when not passed (backward compat)', () => {
    render(<RoomDescription description="Room only" houseRules={null} />)
    expect(screen.getByText('Room only')).toBeInTheDocument()
  })
})
