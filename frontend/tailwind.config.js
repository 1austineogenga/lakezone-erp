/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontSize: {
        xs:   ['0.6875rem', { lineHeight: '1rem' }],       // ~11px
        sm:   ['0.75rem',   { lineHeight: '1.125rem' }],   // 12px
        base: ['0.8125rem', { lineHeight: '1.25rem' }],    // 13px
        lg:   ['0.9375rem', { lineHeight: '1.375rem' }],   // 15px
        xl:   ['1.0625rem', { lineHeight: '1.5rem' }],     // 17px
        '2xl':['1.25rem',   { lineHeight: '1.75rem' }],    // 20px
      },
      colors: {
        brand: {
          red:          '#BF2026',
          'red-dark':   '#9B1A1F',
          'red-light':  '#D94045',
          slate:        '#3C4F5C',
          'slate-dark': '#2B3A44',
          'slate-light':'#5A7282',
          gray:         '#9EADB5',
          'gray-light': '#E8ECEE',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
