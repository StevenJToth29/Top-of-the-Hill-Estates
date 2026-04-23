import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PropertiesSearchFilter from '@/components/admin/PropertiesSearchFilter'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockReplace = jest.fn()
let mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/admin/properties',
  useSearchParams: () => mockSearchParams,
}))

jest.mock('@heroicons/react/24/outline', () => ({
  MagnifyingGlassIcon: () => React.createElement('span', { 'data-testid': 'magnifying-glass-icon' }),
  XMarkIcon: () => React.createElement('span', { 'data-testid': 'x-mark-icon' }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function setup() {
  return render(<PropertiesSearchFilter />)
}

/** Parse the URL passed to mockReplace and return its URLSearchParams. */
function getLastCallParams(): URLSearchParams {
  const calls = mockReplace.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  const url = new URL(calls[calls.length - 1][0], 'http://localhost')
  return url.searchParams
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockReplace.mockClear()
  mockSearchParams = new URLSearchParams()
})

afterEach(() => {
  jest.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('rendering', () => {
  test('renders search input with placeholder', () => {
    setup()
    expect(screen.getByPlaceholderText('Search properties…')).toBeInTheDocument()
  })

  test('renders All, Has Units, and No Units toggle buttons', () => {
    setup()
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Has Units' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No Units' })).toBeInTheDocument()
  })

  test('renders sort select with default option', () => {
    setup()
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(select).toHaveValue('name_asc')
  })

  test('renders all four sort options', () => {
    setup()
    expect(screen.getByRole('option', { name: 'Name A → Z' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Name Z → A' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Most Units' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Fewest Units' })).toBeInTheDocument()
  })
})

describe('search input', () => {
  test('changing search input calls router.replace with q param set to the full value', () => {
    setup()
    // Use fireEvent.change so the full value is dispatched in one event
    fireEvent.change(screen.getByPlaceholderText('Search properties…'), {
      target: { value: 'hello' },
    })
    const params = getLastCallParams()
    expect(params.get('q')).toBe('hello')
  })

  test('router.replace URL uses /admin/properties pathname', () => {
    setup()
    fireEvent.change(screen.getByPlaceholderText('Search properties…'), {
      target: { value: 'a' },
    })
    const lastCall = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0]
    expect(lastCall).toMatch(/^\/admin\/properties\?/)
  })
})

describe('filter toggle buttons', () => {
  test('clicking Has Units calls router.replace with filter=has_units', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Has Units' }))
    const params = getLastCallParams()
    expect(params.get('filter')).toBe('has_units')
  })

  test('clicking No Units calls router.replace with filter=no_units', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'No Units' }))
    const params = getLastCallParams()
    expect(params.get('filter')).toBe('no_units')
  })

  test('clicking All calls router.replace with filter param removed', async () => {
    const user = userEvent.setup()
    // Start with filter already set so clicking All is meaningful
    mockSearchParams = new URLSearchParams('filter=has_units')
    setup()
    await user.click(screen.getByRole('button', { name: 'All' }))
    const params = getLastCallParams()
    expect(params.has('filter')).toBe(false)
  })
})

describe('sort select', () => {
  test('changing sort select calls router.replace with sort param', async () => {
    const user = userEvent.setup()
    setup()
    await user.selectOptions(screen.getByRole('combobox'), 'name_desc')
    const params = getLastCallParams()
    expect(params.get('sort')).toBe('name_desc')
  })

  test('selecting units_desc sets sort=units_desc', async () => {
    const user = userEvent.setup()
    setup()
    await user.selectOptions(screen.getByRole('combobox'), 'units_desc')
    const params = getLastCallParams()
    expect(params.get('sort')).toBe('units_desc')
  })
})

describe('Clear button visibility', () => {
  test('Clear button is hidden when no filters are active (all defaults)', () => {
    // searchParams is empty, so q='', filter='all', sort='name_asc'
    setup()
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
  })

  test('Clear button appears when q is set', () => {
    mockSearchParams = new URLSearchParams('q=test')
    setup()
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  test('Clear button appears when filter is has_units', () => {
    mockSearchParams = new URLSearchParams('filter=has_units')
    setup()
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  test('Clear button appears when filter is no_units', () => {
    mockSearchParams = new URLSearchParams('filter=no_units')
    setup()
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  test('Clear button appears when sort is non-default', () => {
    mockSearchParams = new URLSearchParams('sort=name_desc')
    setup()
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  test('Clear button shows count when multiple filters are active', () => {
    mockSearchParams = new URLSearchParams('q=hello&filter=has_units&sort=units_desc')
    setup()
    // 3 active filters → "Clear (3)"
    expect(screen.getByRole('button', { name: /clear \(3\)/i })).toBeInTheDocument()
  })

  test('Clear button shows no count when exactly one filter is active', () => {
    mockSearchParams = new URLSearchParams('q=hello')
    setup()
    // 1 active filter → "Clear" (no parenthetical)
    const clearBtn = screen.getByRole('button', { name: /clear/i })
    expect(clearBtn.textContent?.trim()).toBe('Clear')
  })
})

describe('Clear button action', () => {
  test('clicking Clear resets all params (q, filter, sort removed)', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('q=test&filter=has_units&sort=units_desc')
    setup()
    await user.click(screen.getByRole('button', { name: /clear/i }))
    const params = getLastCallParams()
    expect(params.has('q')).toBe(false)
    expect(params.has('filter')).toBe(false)
    expect(params.has('sort')).toBe(false)
  })

  test('clicking Clear calls router.replace exactly once', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('q=test')
    setup()
    mockReplace.mockClear()
    await user.click(screen.getByRole('button', { name: /clear/i }))
    expect(mockReplace).toHaveBeenCalledTimes(1)
  })
})
