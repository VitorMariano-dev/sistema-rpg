import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Garante que process.env.API_KEY esteja disponível no código do cliente
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY)
    }
  }
})