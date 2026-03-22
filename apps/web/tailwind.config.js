/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "rgb(var(--color-brand-50) / <alpha-value>)",
          100: "rgb(var(--color-brand-100) / <alpha-value>)",
          500: "rgb(var(--color-brand-500) / <alpha-value>)",
          700: "rgb(var(--color-brand-700) / <alpha-value>)"
        }
      },
      spacing: {
        18: "4.5rem"
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "sans-serif"]
      }
    },
    screens: {
      xs: "360px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px"
    }
  },
  plugins: []
};
