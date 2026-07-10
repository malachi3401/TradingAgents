/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#14181d',
        panel2: '#1b2129',
        panel3: '#232b35',
        edge: '#2e3844',
        accent: '#4f8f4f',
        accent2: '#6aa84f',
        amber: '#c9a227',
        friendly: '#80e0ff',
        hostile: '#ff8080',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
