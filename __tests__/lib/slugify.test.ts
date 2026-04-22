import { slugify } from '@/lib/slugify'

describe('slugify', () => {
  it('lowercases the string', () => {
    expect(slugify('Mountain Suite')).toBe('mountain-suite')
  })

  it('replaces spaces and special characters with hyphens', () => {
    expect(slugify('Room & Board')).toBe('room-board')
  })

  it('collapses multiple non-alphanumeric runs into a single hyphen', () => {
    expect(slugify('A  B--C')).toBe('a-b-c')
  })

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  Suite  ')).toBe('suite')
  })

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })

  it('returns empty string for all-special-character input', () => {
    expect(slugify('!@#$%')).toBe('')
  })

  it('handles accented characters by stripping them (unicode stripped to empty then hyphenated)', () => {
    // Non-ASCII chars are stripped entirely, documenting current behavior
    expect(slugify('café')).toBe('caf')
  })
})
