/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontSize: {
        // Bump the whole scale up ~1–2px for better legibility
        xs:   ['0.8125rem', { lineHeight: '1.25rem' }],   // 13px  (was 12)
        sm:   ['0.9375rem', { lineHeight: '1.4375rem' }],  // 15px  (was 14)
        base: ['1.0625rem', { lineHeight: '1.625rem' }],   // 17px  (was 16)
        lg:   ['1.1875rem', { lineHeight: '1.75rem' }],    // 19px  (was 18)
        xl:   ['1.3125rem', { lineHeight: '1.875rem' }],   // 21px  (was 20)
        '2xl':['1.5625rem', { lineHeight: '2rem' }],       // 25px  (was 24)
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
