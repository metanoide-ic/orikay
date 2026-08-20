import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// A base relativa permite hospedar em subpastas (GitHub Pages, etc).
export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'autoUpdate': a versão nova é baixada e aplicada sozinha, sem
      // depender de ninguém clicar em aviso nenhum — com 'prompt', quem
      // ignorava o aviso ficava preso numa versão velha pra sempre (e
      // reportava como bug coisa que já estava corrigida no ar). Nada se
      // perde no recarregamento: todo o trabalho é salvo a cada mudança.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Orikay',
        short_name: 'Orikay',
        description: 'Gestão de posts, vídeos, quadros e financeiro da agência Origem.',
        theme_color: '#0a0a12',
        background_color: '#0a0a12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { port: 5173, open: true },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
});
