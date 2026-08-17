import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Build para o aplicativo desktop (Electron): caminhos relativos. O service
// worker gerado aqui nunca chega a rodar de verdade — file:// não é um
// contexto seguro e o registro falha em silêncio — mas o plugin precisa
// estar presente para o import de 'virtual:pwa-register/react' (usado no
// aviso de atualização) resolver no build; sem ele o build inteiro quebra.
export default defineConfig({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react(), tailwindcss(), VitePWA({ registerType: 'prompt' })],
  build: {
    outDir: 'dist-desktop',
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
