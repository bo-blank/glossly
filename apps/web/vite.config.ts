// https://vitejs.dev/guide/using-plugins.html
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  
  // Configure CSS processing
  css: {
    preprocessorOptions: {
      // Add your CSS preprocessor here
    }
  },
  
  // Server configuration
  server: {
    port: 5173,
    strictPort: true
  }
});
