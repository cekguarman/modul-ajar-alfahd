import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600, // Menyesuaikan batas batas peringatan menjadi 1600 kB (1.6 MB)
  },
});
