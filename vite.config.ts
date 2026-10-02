import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The site is served from the root domain (santiagosj.github.io) by the
// santiagosj.github.io repo. Set PUBLIC_BASE=/portfolio/ to publish under a
// project repo path instead.
// const base = process.env.PUBLIC_BASE ?? '/'

// GitHub Pages has no server-side rewrites, so a hard refresh or a shared link on
// /projects/ad-lab gets GitHub's 404 page instead of the app. Serving the SPA
// shell as 404.html lets BrowserRouter read the real path and render the route.
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-fallback',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base:'/',
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    spaFallback(),
  ],
})
