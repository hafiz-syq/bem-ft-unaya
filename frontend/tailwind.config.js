/** @type {import('tailwindcss').Config} */
export default {
  // Tema gelap diaktifkan lewat kelas `dark` pada <html>, bukan preferensi OS,
  // supaya pengguna bisa memilih tema secara manual lewat tombol di header.
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}