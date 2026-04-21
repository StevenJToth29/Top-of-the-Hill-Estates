/**
 * @jest-environment node
 */
import { resolveVariables } from '@/lib/email-variables'

// sendEmail is tested implicitly via process-queue tests (mocked Resend)

describe('resolveVariables', () => {
  it('replaces a single known variable', () => {
    expect(resolveVariables('Hello {{guest_first_name}}!', { guest_first_name: 'Alice' }))
      .toBe('Hello Alice!')
  })

  it('replaces multiple variables in one pass', () => {
    expect(
      resolveVariables('{{a}} and {{b}}', { a: 'foo', b: 'bar' }),
    ).toBe('foo and bar')
  })

  it('replaces unknown variable with empty string', () => {
    expect(resolveVariables('val: {{missing}}', {})).toBe('val: ')
  })

  it('leaves plain text unchanged', () => {
    expect(resolveVariables('No tokens here.', {})).toBe('No tokens here.')
  })

  it('replaces the same variable multiple times', () => {
    expect(resolveVariables('{{x}} {{x}}', { x: 'hi' })).toBe('hi hi')
  })

  it('handles HTML surrounding the token', () => {
    expect(
      resolveVariables('<p>Dear {{guest_first_name}},</p>', { guest_first_name: 'Bob' }),
    ).toBe('<p>Dear Bob,</p>')
  })
})
