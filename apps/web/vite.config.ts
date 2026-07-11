// https://vitejs.dev/guide/using-plugins.html
import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [sveltekit()],
  
  // Configure CSS processing
  css: {
    preprocessorOptions: {
      // Add your CSS preprocessor here
    }
  }
});
