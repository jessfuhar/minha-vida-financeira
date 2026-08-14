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
  plugins: [react(), tailwindcss(), ...(singleFile ? [viteSingleFile()] : [])],
  // GitHub Pages serve o build padrão em usuario.github.io/minha-vida-financeira/,
  // não na raiz do domínio — sem isso os assets (JS/CSS) dão 404. O build
  // singlefile continua servido a partir da raiz ('/'), pois é feito para ser
  // aberto direto como arquivo/preview, não publicado num subdiretório.
  base: singleFile ? '/' : '/minha-vida-financeira/',
  build: {
    outDir: singleFile ? 'dist-singlefile' : 'dist',
    cssCodeSplit: !singleFile,
    assetsInlineLimit: singleFile ? 100000000 : 4096,
  },
})
