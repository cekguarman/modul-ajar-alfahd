/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <--- Jalur ini wajib ada agar Tailwind membaca berejo_gambar.tsx
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
