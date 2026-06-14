import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/jeu-de-laiguille/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: "Le jeu de l'aiguille",
        short_name: "L'aiguille",
        description: "Jeu de devinette de spectres entre amis",
        theme_color: '#1e1b2e',
        background_color: '#1e1b2e',
        display: 'standalone',
        start_url: '/jeu-de-laiguille/',
        scope: '/jeu-de-laiguille/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
