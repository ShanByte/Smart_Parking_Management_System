/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          DEFAULT: '#4f46e5',
        },
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f8fafc',
          raised: '#ffffff',
          dark: '#0f172a',
        },
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
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '16px',
        'xl': '24px',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
      },
    },
  },
  plugins: [],
}
