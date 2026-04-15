/** @jest-environment jsdom */

jest.mock('@googlemaps/js-api-loader', () => ({
  Loader: jest.fn().mockImplementation(() => ({
    importLibrary: jest.fn().mockResolvedValue({}),
  })),
  setOptions: jest.fn(),
  importLibrary: jest.fn().mockResolvedValue({}),
}))

import { render, screen, fireEvent } from '@testing-library/react'
import { parseAddressComponents } from '@/components/admin/PlacesAddressInput'
import PlacesAddressInput from '@/components/admin/PlacesAddressInput'

function makeComponent(type: string, longName: string, shortName = longName) {
  return { types: [type], long_name: longName, short_name: shortName }
}

describe('parseAddressComponents', () => {
  it('extracts street number + route as address', () => {
    const result = parseAddressComponents([
      makeComponent('street_number', '123'),
      makeComponent('route', 'Main St'),
      makeComponent('locality', 'Phoenix'),
      makeComponent('administrative_area_level_1', 'Arizona', 'AZ'),
    ])
    expect(result.address).toBe('123 Main St')
    expect(result.city).toBe('Phoenix')
    expect(result.state).toBe('AZ')
  })

  it('uses only route when street_number is absent', () => {
    const result = parseAddressComponents([makeComponent('route', 'Broadway')])
    expect(result.address).toBe('Broadway')
  })

  it('falls back to sublocality when locality is absent', () => {
    const result = parseAddressComponents([makeComponent('sublocality', 'Brooklyn')])
    expect(result.city).toBe('Brooklyn')
  })

  it('prefers locality over sublocality when both are present', () => {
    const result = parseAddressComponents([
      makeComponent('locality', 'New York'),
      makeComponent('sublocality', 'Manhattan'),
    ])
    expect(result.city).toBe('New York')
  })

  it('returns empty object when no matching components exist', () => {
    const result = parseAddressComponents([makeComponent('country', 'United States', 'US')])
    expect(result).toEqual({})
  })

  it('uses short_name for state', () => {
    const result = parseAddressComponents([
      makeComponent('administrative_area_level_1', 'Arizona', 'AZ'),
    ])
    expect(result.state).toBe('AZ')
  })
})

describe('PlacesAddressInput', () => {
  it('renders a text input with the given value', () => {
    render(
      <PlacesAddressInput
        value="123 Main St"
        onChange={jest.fn()}
        onCityChange={jest.fn()}
        onStateChange={jest.fn()}
        placeholder="Street address"
      />
    )
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('123 Main St')
    expect(input).toHaveAttribute('placeholder', 'Street address')
  })

  it('calls onChange when user types', () => {
    const onChange = jest.fn()
    render(
      <PlacesAddressInput
        value=""
        onChange={onChange}
        onCityChange={jest.fn()}
        onStateChange={jest.fn()}
      />
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '456 Oak Ave' } })
    expect(onChange).toHaveBeenCalledWith('456 Oak Ave')
  })
})
