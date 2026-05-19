import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the build runs from any path: a custom domain
  // root (app.superstitionresearch.com), a subfolder, or GitHub Pages.
  base: './',
})
