import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8081', '/oauth2': 'http://localhost:8180' } },
});
