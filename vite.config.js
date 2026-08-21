import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// ──────────────────────────────────────────────────────────────
// Versión de la app, resuelta en tiempo de build.
//
// Sirve para una pregunta muy concreta: cuando Sofía dice "no me aparece el
// cambio", saber si está viendo la última versión o una cacheada por la PWA.
// Por eso se muestra en pantalla (Ajustes y el inicio), no sólo en el bundle.
//
// El commit sale de git en local y de las env vars de Vercel en el deploy,
// donde `git` no siempre está disponible.
// ──────────────────────────────────────────────────────────────
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

function commitCorto() {
  const deVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (deVercel) return deVercel.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return 'local';
  }
}

const fechaBuild = new Date().toISOString().slice(0, 10);

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(fechaBuild),
    __APP_COMMIT__: JSON.stringify(commitCorto()),
  },
  server: { port: 5173, open: true },
  build: { outDir: 'dist', sourcemap: false, emptyOutDir: true },
});
