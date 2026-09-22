import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Mesmo destino do rewrite /api/* do netlify.toml — mantenha os dois em sincronia.
const APPS_SCRIPT_EXEC =
  'https://script.google.com/macros/s/AKfycbyFELrRRh3l_NnPr3Yk8jCJ3A11Cs27pxP7HWneh5EgPamilMf4eRQ8e7tCiaYWzzIq/exec'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // Em produção quem atende /api é o rewrite do Netlify. O servidor de
    // desenvolvimento do Vite não lê o netlify.toml, então sem este proxy todo
    // fetch('/api') em `npm run dev` cai no 404 do próprio Vite e nada do app
    // funciona localmente — login por código, dashboard, simulador.
    proxy: {
      '/api': {
        target: APPS_SCRIPT_EXEC,
        changeOrigin: true,
        // O Apps Script responde 302 para script.googleusercontent.com; como
        // em produção, deixamos o navegador seguir esse salto (em dev não há
        // CSP para bloqueá-lo).
        followRedirects: false,
        rewrite: () => ''
      }
    }
  }
})
