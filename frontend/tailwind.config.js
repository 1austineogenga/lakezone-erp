/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontSize: {
        xs:   ['0.875rem',  { lineHeight: '1.375rem' }],   // 14px  (was 12)
        sm:   ['1rem',      { lineHeight: '1.5rem' }],     // 16px  (was 14)
        base: ['1.125rem',  { lineHeight: '1.75rem' }],    // 18px  (was 16)
        lg:   ['1.25rem',   { lineHeight: '1.875rem' }],   // 20px  (was 18)
        xl:   ['1.375rem',  { lineHeight: '2rem' }],       // 22px  (was 20)
        '2xl':['1.625rem',  { lineHeight: '2.125rem' }],   // 26px  (was 24)
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
