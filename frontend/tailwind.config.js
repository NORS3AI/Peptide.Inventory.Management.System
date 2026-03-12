/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom colors for stock status
        'status-red': '#ef4444',
        'status-orange': '#f97316',
        'status-yellow': '#eab308',
        'status-green': '#22c55e',
        'status-teal': '#14b8a6',
      },
    },
  },
  plugins: [],
}
