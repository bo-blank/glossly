// https://vitejs.dev/guide/using-plugins.html
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  
  // Configure CSS processing
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `\n@use "sass:math"; \n`
      }
    }
  },
  
  // Server configuration
  server: {
    port: 5173,
    strictPort: true
  }
});
