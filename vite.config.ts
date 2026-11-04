/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Configuración de Vite (la herramienta que compila la app).
// VitePWA convierte la web en una app instalable que funciona sin conexión:
// genera el "manifest" (nombre, íconos, colores) y un service worker que
// guarda la app en el celular.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Memora',
        short_name: 'Memora',
        description: 'Tu carpeta de estudio interactiva: cuadernos, temas, juegos y repaso.',
        lang: 'es',
        theme_color: '#5b4cf0',
        background_color: '#f6f5fb',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cualquier ruta (/cuaderno/3, /tema/8...) abre la app aunque no haya internet.
        navigateFallback: '/index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
