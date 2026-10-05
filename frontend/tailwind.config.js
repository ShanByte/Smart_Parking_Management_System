/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parking: {
          available: {
            DEFAULT: '#10b981', // emerald-500
            light: '#d1fae5',   // emerald-100
            dark: '#047857',    // emerald-700
          },
          held: {
            DEFAULT: '#f59e0b', // amber-500
            light: '#fef3c7',   // amber-100
            dark: '#b45309',    // amber-700
          },
          reserved: {
            DEFAULT: '#3b82f6', // blue-500
            light: '#dbeafe',   // blue-100
            dark: '#1d4ed8',    // blue-700
          },
          occupied: {
            DEFAULT: '#ef4444', // red-500
            light: '#fee2e2',   // red-100
            dark: '#b91c1c',    // red-700
          },
        },
      },
    },
  },
  plugins: [],
}
