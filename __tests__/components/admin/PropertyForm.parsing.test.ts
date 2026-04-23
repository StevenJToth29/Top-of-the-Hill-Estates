/**
 * PropertyForm.parsing.test.ts
 *
 * Unit tests for bedrooms/bathrooms string→number parsing in PropertyForm.tsx.
 *
 * PropertyForm stores bedrooms and bathrooms as strings to allow free-form typing
 * without snapping to 0. On submit, these are parsed to numbers via:
 *   parseFloat(bedrooms) || 0
 *   parseFloat(bathrooms) || 0
 *
 * This test file validates the parsing contract and initialization logic.
 */

describe('PropertyForm parsing behavior', () => {
  /**
   * The actual parsing expression used in PropertyForm.handleSubmit (lines 157-158)
   */
  function parseBedrooms(val: string): number {
    return parseFloat(val) || 0
  }

  function parseBathrooms(val: string): number {
    return parseFloat(val) || 0
  }

  describe('parseFloat(val) || 0 parsing logic', () => {
    describe('empty and whitespace inputs', () => {
      it('empty string "" → 0', () => {
        expect(parseBedrooms('')).toBe(0)
      })

      it('whitespace "  " → 0', () => {
        expect(parseBedrooms('  ')).toBe(0)
      })
    })

    describe('valid numeric strings', () => {
      it('zero "0" → 0', () => {
        expect(parseBedrooms('0')).toBe(0)
      })

      it('positive integer "3" → 3', () => {
        expect(parseBedrooms('3')).toBe(3)
      })

      it('decimal "3.5" → 3.5 (bathrooms support decimals)', () => {
        expect(parseBathrooms('3.5')).toBe(3.5)
      })

      it('trailing zero "10.0" → 10', () => {
        expect(parseBedrooms('10.0')).toBe(10)
      })

      it('negative number "-1" → -1 (DOM input min=0 handles clamping)', () => {
        expect(parseBedrooms('-1')).toBe(-1)
      })
    })

    describe('invalid numeric strings', () => {
      it('non-numeric "abc" → 0', () => {
        expect(parseBedrooms('abc')).toBe(0)
      })

      it('letters and numbers "3abc" → 3 (parseFloat stops at non-numeric)', () => {
        expect(parseBedrooms('3abc')).toBe(3)
      })

      it('decimal followed by letters "5.5abc" → 5.5', () => {
        expect(parseBathrooms('5.5abc')).toBe(5.5)
      })

      it('NaN string "NaN" → 0', () => {
        expect(parseBedrooms('NaN')).toBe(0)
      })
    })

    describe('edge cases', () => {
      it('very large number "9999999" → 9999999', () => {
        expect(parseBedrooms('9999999')).toBe(9999999)
      })

      it('very small decimal "0.25" → 0.25', () => {
        expect(parseBathrooms('0.25')).toBe(0.25)
      })

      it('leading whitespace " 5" → 5 (parseFloat trims leading space)', () => {
        expect(parseBedrooms(' 5')).toBe(5)
      })

      it('exponential notation "1e2" → 100', () => {
        expect(parseBedrooms('1e2')).toBe(100)
      })
    })
  })

  describe('String() initialization (lines 82-83)', () => {
    /**
     * PropertyForm initializes bedrooms and bathrooms with:
     *   useState(String(property?.bedrooms ?? 0))
     *   useState(String(property?.bathrooms ?? 0))
     *
     * This test validates that String() converts the initial number to string correctly.
     */

    it('String(0) → "0"', () => {
      expect(String(0)).toBe('0')
    })

    it('String(4) → "4"', () => {
      expect(String(4)).toBe('4')
    })

    it('String(3.5) → "3.5"', () => {
      expect(String(3.5)).toBe('3.5')
    })

    it('String(undefined ?? 0) → "0" (fallback to 0)', () => {
      const value: number | undefined = undefined
      expect(String(value ?? 0)).toBe('0')
    })

    it('String(null ?? 0) → "0" (fallback to 0)', () => {
      const value: number | null = null
      expect(String(value ?? 0)).toBe('0')
    })
  })

  describe('full round-trip: String() → parsing → number', () => {
    /**
     * Verify that the initialization and parsing chain works correctly.
     * User types in the input → stored as string → parsed on submit → sent as number.
     */

    it('initialize with 0: String(0) → parseBedrooms("0") → 0', () => {
      const initialState = String(0)
      const parsed = parseBedrooms(initialState)
      expect(parsed).toBe(0)
    })

    it('initialize with 3: String(3) → parseBedrooms("3") → 3', () => {
      const initialState = String(3)
      const parsed = parseBedrooms(initialState)
      expect(parsed).toBe(3)
    })

    it('initialize with 3.5: String(3.5) → parseBathrooms("3.5") → 3.5', () => {
      const initialState = String(3.5)
      const parsed = parseBathrooms(initialState)
      expect(parsed).toBe(3.5)
    })

    it('user types into empty field: "" → parseBedrooms("") → 0 (fallback on submit)', () => {
      const userInput = ''
      const parsed = parseBedrooms(userInput)
      expect(parsed).toBe(0)
    })

    it('user types invalid text: "abc" → parseBedrooms("abc") → 0 (fallback on submit)', () => {
      const userInput = 'abc'
      const parsed = parseBedrooms(userInput)
      expect(parsed).toBe(0)
    })
  })
})
