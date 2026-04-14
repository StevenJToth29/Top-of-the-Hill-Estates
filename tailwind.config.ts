import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#08080E',
        'surface-lowest': '#0C0C14',
        'surface-low': '#111120',
        surface: '#16162A',
        'surface-container': '#1C1C32',
        'surface-high': '#22223C',
        'surface-highest': '#2A2A46',
        primary: '#4ECDC4',
        secondary: '#26A69A',
        'on-surface': '#E8ECF0',
        'on-surface-variant': '#94A3B8',
        'outline-variant': 'rgba(78,205,196,0.18)',
        error: '#FF7675',
        'error-container': '#7F1D1D',
      },
      fontFamily: {
        display: ['var(--font-manrope)', 'sans-serif'],
        body: ['var(--font-jakarta)', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '40px',
        '3xl': '64px',
      },
    },
  },
  plugins: [],
}

export default config
