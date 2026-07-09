/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontSize: {
        xs:   ['0.8125rem', { lineHeight: '1.25rem' }],    // 13px
        sm:   ['0.875rem',  { lineHeight: '1.375rem' }],   // 14px
        base: ['0.9375rem', { lineHeight: '1.5rem' }],     // 15px
        lg:   ['1.0625rem', { lineHeight: '1.625rem' }],   // 17px
        xl:   ['1.1875rem', { lineHeight: '1.75rem' }],    // 19px
        '2xl':['1.5rem',    { lineHeight: '2rem' }],       // 24px
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
