import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appBasePath = '/';

export default defineConfig({
  base: appBasePath,
  plugins: [react()],
  build: {
    target: 'es2019',
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          realtime: ['socket.io-client'],
        },
      },
    },
  },
});
