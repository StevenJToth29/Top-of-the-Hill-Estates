import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsForm from '@/components/admin/SettingsForm'
import type { PaymentMethodConfig, SiteSettings } from '@/types'

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement('img', { src, alt }),
}))

jest.mock('@heroicons/react/24/outline', () => ({
  PhotoIcon: () => React.createElement('span', { 'data-testid': 'photo-icon' }),
  SparklesIcon: () => React.createElement('span', { 'data-testid': 'sparkles-icon' }),
  XMarkIcon: () => React.createElement('span', { 'data-testid': 'x-mark-icon' }),
  ArrowPathIcon: () => React.createElement('span', { 'data-testid': 'arrow-path-icon' }),
  CheckIcon: () => React.createElement('span', { 'data-testid': 'check-icon' }),
}))

jest.mock('@/lib/supabase-browser', () => ({
  createClient: jest.fn(),
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

const baseSettings: SiteSettings = {
  id: 'settings-1',
  business_name: 'Test Business',
  about_text: 'About us text',
  contact_phone: '(555) 123-4567',
  contact_email: 'info@test.com',
  contact_address: '123 Main St',
  logo_url: '',
  logo_size: 52,
  business_hours: undefined,
  updated_at: '2024-01-01T00:00:00Z',
}

const basePaymentMethodConfigs: PaymentMethodConfig[] = []

function setup(settings: SiteSettings = baseSettings) {
  return render(<SettingsForm settings={settings} paymentMethodConfigs={basePaymentMethodConfigs} />)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchSuccess() {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true }),
  })
}

function mockFetchError(message: string) {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: message }),
  })
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.resetAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('rendering', () => {
  test('renders business name field with settings value', () => {
    setup()
    expect(screen.getByLabelText('Business Name')).toHaveValue('Test Business')
  })

  test('renders about text with settings value', () => {
    setup()
    expect(screen.getByLabelText('About Us Text')).toHaveValue('About us text')
  })

  test('renders phone field with settings value', () => {
    setup()
    expect(screen.getByLabelText('Phone')).toHaveValue('(555) 123-4567')
  })

  test('renders email field with settings value', () => {
    setup()
    expect(screen.getByLabelText('Email')).toHaveValue('info@test.com')
  })

  test('renders address field with settings value', () => {
    setup()
    expect(screen.getByLabelText('Address')).toHaveValue('123 Main St')
  })

  test('uses fallback business name when value is null/undefined', () => {
    setup({ ...baseSettings, business_name: undefined as unknown as string })
    expect(screen.getByLabelText('Business Name')).toHaveValue('Top of the Hill Rooms')
  })

  test('renders all 7 days in business hours section', () => {
    setup()
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(screen.getByText(day)).toBeInTheDocument()
    }
  })

  test('renders Save Settings submit button', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Save Settings' })).toBeInTheDocument()
  })

  test('shows current logo size in px', () => {
    setup()
    expect(screen.getByText('52px')).toBeInTheDocument()
  })
})

describe('phone formatting', () => {
  test('formats 10 digits as (XXX) XXX-XXXX', async () => {
    const user = userEvent.setup()
    setup({ ...baseSettings, contact_phone: '' })
    const phoneInput = screen.getByLabelText('Phone')
    await user.type(phoneInput, '5551234567')
    expect(phoneInput).toHaveValue('(555) 123-4567')
  })

  test('partially typed digits remain formatted without dashes until 7+', async () => {
    const user = userEvent.setup()
    setup({ ...baseSettings, contact_phone: '' })
    const phoneInput = screen.getByLabelText('Phone')
    await user.type(phoneInput, '555')
    expect(phoneInput).toHaveValue('555')
  })

  test('4 digits format as (XXX) X', async () => {
    const user = userEvent.setup()
    setup({ ...baseSettings, contact_phone: '' })
    const phoneInput = screen.getByLabelText('Phone')
    await user.type(phoneInput, '5551')
    expect(phoneInput).toHaveValue('(555) 1')
  })
})

describe('validation', () => {
  test('shows phone error when phone is incomplete on submit', async () => {
    const user = userEvent.setup()
    setup({ ...baseSettings, contact_phone: '' })
    await user.type(screen.getByLabelText('Phone'), '555123')
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(screen.getByText('Phone number must be 10 digits')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('shows email error for invalid email format on submit', async () => {
    const user = userEvent.setup()
    setup({ ...baseSettings, contact_email: '' })
    await user.type(screen.getByLabelText('Email'), 'notanemail')
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('clears phone error when user edits the field', async () => {
    const user = userEvent.setup()
    setup({ ...baseSettings, contact_phone: '' })
    await user.type(screen.getByLabelText('Phone'), '555123')
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(screen.getByText('Phone number must be 10 digits')).toBeInTheDocument()
    // Typing more characters should clear the error
    await user.type(screen.getByLabelText('Phone'), '4')
    expect(screen.queryByText('Phone number must be 10 digits')).not.toBeInTheDocument()
  })

  test('allows empty phone — only validates if a value is present', async () => {
    mockFetchSuccess()
    const user = userEvent.setup()
    setup({ ...baseSettings, contact_phone: '' })
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(screen.queryByText('Phone number must be 10 digits')).not.toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
  })

  test('allows empty email — only validates if a value is present', async () => {
    mockFetchSuccess()
    const user = userEvent.setup()
    setup({ ...baseSettings, contact_email: '' })
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
  })
})

describe('form submission', () => {
  test('sends PATCH request to /api/admin/settings', async () => {
    mockFetchSuccess()
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/settings',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    )
  })

  test('serializes business_hours as a JSON string in the request body', async () => {
    mockFetchSuccess()
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [, options] = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(options.body)
    expect(typeof body.business_hours).toBe('string')
    const hours = JSON.parse(body.business_hours)
    expect(hours.Mon).toBeDefined()
  })

  test('shows "Settings saved." on successful save', async () => {
    mockFetchSuccess()
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    await waitFor(() => expect(screen.getByText('Settings saved.')).toBeInTheDocument())
  })

  test('shows API error message on failed save', async () => {
    mockFetchError('Database connection failed')
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    await waitFor(() =>
      expect(screen.getByText('Database connection failed')).toBeInTheDocument(),
    )
  })

  test('shows fallback error when API response has no error field', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    })
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    await waitFor(() =>
      expect(screen.getByText('Failed to save settings')).toBeInTheDocument(),
    )
  })

  test('shows "Network error" when fetch throws', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network failure'))
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument())
  })

  test('disables submit button and shows "Saving…" while request is in flight', async () => {
    let resolveRequest!: (val: unknown) => void
    ;(global.fetch as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => { resolveRequest = resolve }),
    )
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'Save Settings' }))
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    // Resolve the in-flight request so the component finishes
    resolveRequest({ ok: true, json: async () => ({ success: true }) })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Settings' })).toBeEnabled())
  })
})

describe('business hours', () => {
  test('Sunday defaults to closed (closed state in initial render)', () => {
    setup()
    const sunToggle = screen.getByRole('button', { name: 'Toggle Sun' })
    expect(sunToggle).toHaveClass('bg-surface-high')
  })

  test('Mon starts open and shows time inputs', () => {
    setup()
    const monToggle = screen.getByRole('button', { name: 'Toggle Mon' })
    expect(monToggle).toHaveClass('bg-primary')
  })

  test('toggling Mon to closed removes its time inputs and shows "Closed"', async () => {
    const user = userEvent.setup()
    setup()
    // Initially only Sun is closed
    expect(screen.getAllByText('Closed')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Toggle Mon' }))
    // Now Mon and Sun are both closed
    expect(screen.getAllByText('Closed')).toHaveLength(2)
  })

  test('toggling a closed day back to open shows time inputs again', async () => {
    const user = userEvent.setup()
    setup()
    // Toggle Sun open
    await user.click(screen.getByRole('button', { name: 'Toggle Sun' }))
    expect(screen.queryAllByText('Closed')).toHaveLength(0)
  })
})

describe('logo size slider', () => {
  test('updates the displayed px label when slider value changes', () => {
    setup()
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '64' } })
    expect(screen.getByText('64px')).toBeInTheDocument()
  })

  test('slider respects min/max bounds (32–96)', () => {
    setup()
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('min', '32')
    expect(slider).toHaveAttribute('max', '96')
  })
})
