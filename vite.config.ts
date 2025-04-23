import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  base: '/chat_new1/'
})
// vite.config.js
// import { defineConfig } from 'vite';
// import react from '@vitejs/plugin-react';

// export default defineConfig({
//     plugins: [react()],
//     base: process.env.VITE_BASE_URL || '/',
// });
