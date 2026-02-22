/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand)',
        'brand-2': 'var(--brand-2)',
        'brand-text': 'var(--brand-text)',
        bg: 'var(--bg)',
        'bg-2': 'var(--bg-2)',
        'widget-bg': 'var(--widget-bg)',
        'box-bg': 'var(--box-bg)',
        'box-border': 'var(--box-border)',
        'box-hover': 'var(--box-hover)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
      },
      borderRadius: {
        widget: 'var(--radius)',
      },
    },
  },
  plugins: [],
}
