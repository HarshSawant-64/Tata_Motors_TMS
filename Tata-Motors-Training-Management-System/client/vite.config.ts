import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/Tata_Motors_TMS/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
});
