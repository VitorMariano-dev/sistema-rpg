import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Só variáveis com prefixo VITE_ chegam ao navegador (import.meta.env).
// A GEMINI_API_KEY fica apenas na Netlify Function.
export default defineConfig({
  plugins: [react()],
})
