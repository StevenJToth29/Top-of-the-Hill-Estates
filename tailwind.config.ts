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
        // All colors reference CSS variables so the admin data-admin context
        // can override them to a dark theme without any class changes.
        background:          'rgb(var(--color-background) / <alpha-value>)',
        'surface-lowest':    'rgb(var(--color-surface-lowest) / <alpha-value>)',
        'surface-low':       'rgb(var(--color-surface-low) / <alpha-value>)',
        surface:             'rgb(var(--color-surface) / <alpha-value>)',
        'surface-container': 'rgb(var(--color-surface-container) / <alpha-value>)',
        'surface-high':      'rgb(var(--color-surface-high) / <alpha-value>)',
        'surface-highest':   'rgb(var(--color-surface-highest) / <alpha-value>)',
        primary:             'rgb(var(--color-primary) / <alpha-value>)',
        secondary:           'rgb(var(--color-secondary) / <alpha-value>)',
        'on-surface':        'rgb(var(--color-on-surface) / <alpha-value>)',
        'on-surface-variant':'rgb(var(--color-on-surface-variant) / <alpha-value>)',
        'outline-variant':   'rgba(45,212,191,0.20)',
        error:               'rgb(var(--color-error) / <alpha-value>)',
        'error-container':   'rgb(var(--color-error-container) / <alpha-value>)',
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
