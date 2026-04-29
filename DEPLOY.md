# Deploy a producción · Dashboard Sofía Lira

> Tres cosas que necesitan tu mano (no las puedo hacer por ti):
> A) Crear proyecto Supabase + correr SQL + activar Google OAuth
> B) Subir el código a GitHub
> C) Conectar Vercel y pegar las env vars
>
> El resto del código ya está listo. Tiempo total estimado: **~25 min**.

---

## A. Supabase (~10 min)

1. Entra a **https://supabase.com** con tu Google (`jclira@gmail.com`).
2. Click **New project**.
   - Name: `dashboard-sofia`
   - Database password: genera uno fuerte y guárdalo en tu password manager
   - Region: `South America (São Paulo)` (más cercano a Ecuador)
   - Plan: **Free**
3. Espera ~2 min a que termine de aprovisionar.

4. **Correr el SQL del schema**
   - Sidebar izquierdo → **SQL Editor** → **New query**
   - Abre `supabase/schema.sql` (en este repo) y copia todo el contenido
   - Pégalo en el editor → click **Run**
   - Debe decir "Success. No rows returned"

5. **Activar Google OAuth**
   - Sidebar → **Authentication** → **Providers** → **Google**
   - Toggle **Enable Sign in with Google** → ON
   - Marca **Use Supabase as Auth Server** (sin Google Cloud Console propio — es la opción más rápida)
   - Click **Save**

6. **Copiar credenciales**
   - Sidebar → **Settings** (⚙️) → **API**
   - Copia el **Project URL** (algo tipo `https://xxxxx.supabase.co`)
   - Copia la **anon public** key (la `eyJhbGc…` larga)
   - Crea el archivo `.env.local` en la raíz del proyecto con:
     ```
     VITE_SUPABASE_URL=https://xxxxx.supabase.co
     VITE_SUPABASE_ANON_KEY=eyJhbGc...
     ```

7. **Probar local**: `npm run dev` y entra con `jclira@gmail.com` o `sofilira@gmail.com`. Cualquier otro email debe ser rechazado.

---

## B. GitHub (~5 min)

1. En GitHub, **New repository** → privado, nombre `dashboard-sofia` (o el que quieras).
   No inicialices con README ni .gitignore (ya los tenemos).

2. En la terminal **nativa de tu Mac** (no la mía, mi sandbox no tiene permisos completos), desde la raíz del proyecto:
   ```bash
   cd "/Users/carabela/Desktop/Claude Workspace/proyectos/dashboardSofi"
   rm -rf .git                       # limpia el .git parcial que dejé
   git init -b main
   git add .
   git commit -m "Dashboard Sofía Lira: Vite + Supabase + Google OAuth"
   git remote add origin https://github.com/<tu-usuario>/dashboard-sofia.git
   git push -u origin main
   ```

---

## C. Vercel (~10 min)

1. Entra a **https://vercel.com** con GitHub.
2. **Add New… → Project** → selecciona el repo `dashboard-sofia`.
3. **Framework preset**: Vite (lo detecta solo).
4. **Environment Variables**: añade dos:
   - `VITE_SUPABASE_URL` = (la URL de Supabase)
   - `VITE_SUPABASE_ANON_KEY` = (la anon key)
5. Click **Deploy**.
6. Cuando termine (~1 min), copia la URL del deploy (algo tipo `https://dashboard-sofia.vercel.app`).

7. **Volver a Supabase** y autorizar la URL de Vercel:
   - Authentication → URL Configuration → **Site URL**: pega la URL de Vercel
   - **Redirect URLs**: añade la misma URL + `/**`
   - Save

Listo. Sofía entra a la URL de Vercel, hace clic en "Continuar con Google", y ya está dentro.

---

## Si algo falla

| Síntoma | Causa probable | Fix |
|---|---|---|
| "El email X no está autorizado" tras login | Email no está en whitelist | Editar `src/lib/supabase.js` y `supabase/schema.sql` (función `is_authorized`) |
| Login se queda en bucle | Site URL / Redirect URLs mal configurados en Supabase | Asegurar que la URL de Vercel está en ambos campos |
| `VITE_SUPABASE_URL is undefined` | Env vars no están en Vercel o falta el prefijo `VITE_` | Settings → Environment Variables → redeploy |
| Las alumnas no se guardan | RLS rechazando inserts | Verificar que el SQL se corrió completo y que la función `is_authorized()` existe |

---

## Para añadir otra usuaria después

1. En `supabase/schema.sql`, función `is_authorized()`: añadir el email a la lista.
2. En `src/lib/supabase.js`, array `ALLOWED_EMAILS`: añadir el mismo email.
3. Volver a correr la función (CREATE OR REPLACE) en SQL Editor.
4. Push a GitHub → Vercel redeploya solo.

## Lo que aún vive en localStorage (no en Supabase)

Por la primera iteración solo migramos **alumnas** + **pagos** a Supabase. Esto sigue en el navegador de Sofía:

- Leads
- Asistencia
- Ajustes (precios, fechas, plantillas WhatsApp)
- Mensajes recientes

Si Sofía borra el caché del navegador, pierde estos datos. Para migrarlos a Supabase: cuando me digas, replico el patrón de `useAlumnas.js` para cada uno (~30 min cada feature).
