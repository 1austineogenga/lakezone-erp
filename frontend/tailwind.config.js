/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontSize: {
        xs:   ['0.75rem',   { lineHeight: '1.125rem' }],   // 12px
        sm:   ['0.8125rem', { lineHeight: '1.25rem' }],    // 13px
        base: ['0.875rem',  { lineHeight: '1.375rem' }],   // 14px
        lg:   ['1rem',      { lineHeight: '1.5rem' }],     // 16px
        xl:   ['1.125rem',  { lineHeight: '1.625rem' }],   // 18px
        '2xl':['1.375rem',  { lineHeight: '1.875rem' }],   // 22px
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
