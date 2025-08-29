/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          purple: '#7234BB',
          darkBlue: '#080854',
        },
        custom: {
          purple: '#7234BB',
          darkBlue: '#080854',
        },
        "gray-1000": "var(--ds-gray-1000)",
        "error": "var(--geist-error)",
        "warning": "var(--geist-warning)",
        "cyan": "var(--geist-cyan)",
        "accents-2": "var(--accents-2)",
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #7234BB 0%, #080854 100%)',
        'gradient-primary-reverse': 'linear-gradient(135deg, #080854 0%, #7234BB 100%)',
        'gradient-primary-horizontal': 'linear-gradient(90deg, #7234BB 0%, #080854 100%)',
      }
    },
  },
  plugins: [],
}
