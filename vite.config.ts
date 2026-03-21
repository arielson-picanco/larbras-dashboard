import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      proxy: {
        // ── Anthropic Claude ──────────────────────────────────
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

        // ── Google Gemini ─────────────────────────────────────
        // Key is passed as query param in the fetch URL (Gemini style)
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

        // ── Groq (Llama 3 — free) ─────────────────────────────
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
