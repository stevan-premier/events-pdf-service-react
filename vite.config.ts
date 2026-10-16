import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: env.API_PROXY_TARGET ? {
      proxy: { '/api': { target: env.API_PROXY_TARGET, changeOrigin: true }, '/vc/api': { target: env.API_PROXY_TARGET, changeOrigin: true } },
    } : undefined,
  }
})
