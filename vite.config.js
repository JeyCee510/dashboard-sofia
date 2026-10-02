import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

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

// ──────────────────────────────────────────────────────────────
// Vista previa propia por página pública (WhatsApp, Instagram, etc.).
//
// La app es una SPA: todas las rutas sirven el mismo index.html, así que el
// link del viaje mostraba la portada del Seminario. Los bots de vista previa
// no ejecutan JS, por eso no basta con cambiar las meta desde React.
// Solución: al terminar el build se escribe una copia de index.html con sus
// propias etiquetas Open Graph, y vercel.json la sirve SÓLO para esa ruta.
// La app arranca igual (mismo bundle) y lee la ruta real del navegador.
// Para sumar otra página: agregar una entrada aquí + su rewrite en vercel.json.
// ──────────────────────────────────────────────────────────────
const BASE_URL = 'https://dashboard-sofia.vercel.app';
const PAGINAS_OG = [
  {
    archivo: 'og/viaje-india.html',
    // URL canónica: el atajo corto. WhatsApp ya tenía cacheada la vista previa
    // vieja de /viaje/viaje-india y no hay forma de purgarla desde aquí.
    ruta: '/india',
    titulo: 'India Retreat 2027 · Sofía Lira Yoga',
    descripcion: '15 días por el norte de la India · 2 al 16 de marzo 2027 · Taller intensivo de yoga en Rishikesh con Angelo Cecchi',
    imagen: '/viaje-india/og.jpg?v=2',
    ancho: 1200, alto: 630,
  },
];

const escapar = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function paginasOpenGraph() {
  return {
    name: 'paginas-open-graph',
    apply: 'build',
    closeBundle() {
      const base = readFileSync('dist/index.html', 'utf8');
      for (const p of PAGINAS_OG) {
        const meta = (prop, val) => [new RegExp(`(<meta (?:property|name)="${prop}" content=")[^"]*(")`), `$1${escapar(val)}$2`];
        const reemplazos = [
          [/<title>[^<]*<\/title>/, `<title>${escapar(p.titulo)}</title>`],
          meta('og:title', p.titulo),
          meta('og:description', p.descripcion),
          meta('og:url', BASE_URL + p.ruta),
          meta('og:image', BASE_URL + p.imagen),
          meta('og:image:width', p.ancho),
          meta('og:image:height', p.alto),
          meta('og:image:alt', p.titulo),
          meta('twitter:title', p.titulo),
          meta('twitter:description', p.descripcion),
          meta('twitter:image', BASE_URL + p.imagen),
        ];
        let html = base;
        for (const [re, val] of reemplazos) {
          if (!re.test(html)) throw new Error(`[og] no encontré ${re} en index.html`);
          html = html.replace(re, val);
        }
        const destino = `dist/${p.archivo}`;
        mkdirSync(destino.slice(0, destino.lastIndexOf('/')), { recursive: true });
        writeFileSync(destino, html);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), paginasOpenGraph()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(fechaBuild),
    __APP_COMMIT__: JSON.stringify(commitCorto()),
  },
  server: { port: 5173, open: true },
  build: { outDir: 'dist', sourcemap: false, emptyOutDir: true },
});
