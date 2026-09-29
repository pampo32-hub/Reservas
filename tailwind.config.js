/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{html,js}",
    "./public/**/*.{html,js}",
    "./*.html"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F172A',
          dark: '#020617',
          container: '#1E3A8A',
          light: '#2563EB',
          fixed: '#93C5FD',
          'on-primary': '#ffffff',
          'on-container': '#DBEAFE',
        },
        secondary: {
          DEFAULT: '#1E293B',
          container: '#DBEAFE',
          'on-secondary': '#ffffff',
          'on-container': '#0F172A',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          bright: '#ffffff',
          dim: '#E2E8F0',
          'container-lowest': '#ffffff',
          'container-low': '#F1F5F9',
          'container': '#E2E8F0',
          'container-high': '#CBD5E1',
          'container-highest': '#94A3B8',
        },
        'on-surface': {
          DEFAULT: '#0F172A',
          variant: '#475569',
        },
        outline: {
          DEFAULT: '#64748B',
          variant: 'rgba(203, 213, 225, 0.4)',
        },
        blue: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#0F172A',
        },
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#2563EB',
          600: '#1E40AF',
          700: '#1E3A8A',
          900: '#0F172A',
        },
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
        indigo: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#1E1B4B',
          950: '#0F172A',
        },
        purple: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#0F172A',
        },
        emerald: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        amber: {
          50: '#F8FAFC',
          100: '#EFF6FF',
          400: '#60A5FA',
          500: '#2563EB',
          600: '#1E40AF',
        }
      },
      fontFamily: {
        headline: ["Space Grotesk", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        sans: ["Inter", "sans-serif"]
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        'full': '9999px'
      },
      boxShadow: {
        'ambient': '0 24px 44px -12px rgba(15, 23, 42, 0.07)',
        'zenith': '0 14px 34px rgba(15, 23, 42, 0.05)',
        'luminous': '0 0 28px rgba(37, 99, 235, 0.25)',
      }
    }
  },
  plugins: []
};
