import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
// Two build modes:
//  - `npm run dev` / normal `vite build`: standard multi-file build (for real deployment later)
//  - `npm run build:singlefile`: inlines everything into one HTML file (for quick preview/sharing)
const singleFile = process.env.BUILD_TARGET === 'singlefile'

export default defineConfig({
  base: '/minha-vida-financeira/',
  plugins: [react(), tailwindcss(), ...(singleFile ? [viteSingleFile()] : [])],
  build: {
    outDir: singleFile ? 'dist-singlefile' : 'dist',
    cssCodeSplit: !singleFile,
    assetsInlineLimit: singleFile ? 100000000 : 4096,
  },
})
