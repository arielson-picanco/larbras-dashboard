import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path  from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Em modo API, o frontend proxia tudo para o backend Node.js
  // As chaves de IA ficam no backend — não no .env do frontend
  const useBackend = env.VITE_USE_API === 'true'
  const backendUrl = env.VITE_API_URL ?? 'http://localhost:3001'

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      proxy: useBackend
        // ── Modo backend: proxia /api/* para Node.js ──────────────────────────
        ? {
            '/api': {
              target:       backendUrl,
              changeOrigin: true,
            },
          }
        // ── Modo local: proxia direto para as APIs externas ───────────────────
        : {
            '/api/claude': {
              target:       'https://api.anthropic.com',
              changeOrigin: true,
              rewrite:      (p) => p.replace(/^\/api\/claude/, '/v1/messages'),
              configure:    (proxy) => {
                proxy.on('proxyReq', (proxyReq) => {
                  const key = env.VITE_ANTHROPIC_API_KEY ?? ''
                  proxyReq.setHeader('x-api-key',                                 key)
                  proxyReq.setHeader('anthropic-version',                         '2023-06-01')
                  proxyReq.setHeader('anthropic-dangerous-direct-browser-access', 'true')
                  proxyReq.setHeader('content-type',                              'application/json')
                  proxyReq.removeHeader('origin')
                  proxyReq.removeHeader('referer')
                })
              },
            },
            '/api/gemini': {
              target:       'https://generativelanguage.googleapis.com',
              changeOrigin: true,
              rewrite:      (p) => p.replace(/^\/api\/gemini/, ''),
              configure:    (proxy) => {
                proxy.on('proxyReq', (proxyReq) => {
                  proxyReq.setHeader('content-type', 'application/json')
                  proxyReq.removeHeader('origin')
                  proxyReq.removeHeader('referer')
                })
              },
            },
            '/api/groq': {
              target:       'https://api.groq.com',
              changeOrigin: true,
              rewrite:      (p) => p.replace(/^\/api\/groq/, '/openai/v1/chat/completions'),
              configure:    (proxy) => {
                proxy.on('proxyReq', (proxyReq) => {
                  const key = env.VITE_GROQ_API_KEY ?? ''
                  proxyReq.setHeader('Authorization', `Bearer ${key}`)
                  proxyReq.setHeader('content-type',  'application/json')
                  proxyReq.removeHeader('origin')
                  proxyReq.removeHeader('referer')
                })
              },
            },
          },
    },
  }
})
