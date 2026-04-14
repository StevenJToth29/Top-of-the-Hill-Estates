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
        background: '#061423',
        'surface-lowest': '#020f1e',
        'surface-low': '#0d1f30',
        surface: '#14283a',
        'surface-container': '#1b3347',
        'surface-high': '#22405a',
        'surface-highest': '#283646',
        primary: '#c6c7c3',
        secondary: '#afc9ea',
        'on-surface': '#e8eaf0',
        'on-surface-variant': '#c4c6cc',
        'outline-variant': 'rgba(196,198,204,0.15)',
        error: '#ffb4ab',
        'error-container': '#93000a',
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
