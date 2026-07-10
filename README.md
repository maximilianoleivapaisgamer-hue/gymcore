# GymCore — App premium para gimnasios (Next.js + Supabase)

Base del proyecto real para migrar GymCore de Bubble a un stack moderno, seguro y escalable.

## Qué incluye este arranque

- **Next.js 14 (App Router) + TypeScript + Tailwind** con el sistema de diseño premium ya definido (mismos colores del prototipo).
- **Base de datos multi-tenant con Row-Level Security** (`supabase/schema.sql`): cada gimnasio ve SOLO sus datos. Esto resuelve el problema de "datos públicos" que tenía la app en Bubble.
- **Landing pública white-label** por gimnasio (`/[slug]`) que lee el branding real del dueño.
- **Editor de la página** (`/dashboard/configuracion`): subir logo y foto de portada a Supabase Storage, elegir color, editar textos/planes, con preview en vivo y guardado.
- **Auth con roles** (super_admin / owner / member) vía Supabase + middleware que protege el panel.
- **Modelo de suscripción del SaaS** (`subscriptions`): lo que le cobrás al dueño, con planes (básico/pro/elite) y estados (trial/activo/moroso).

## Estructura

```
app/
  page.tsx                      Home del SaaS
  (public)/[slug]/page.tsx      Landing pública del gimnasio
  dashboard/configuracion/      Editor de la página (subida de imágenes + preview)
lib/
  supabase-browser.ts           Cliente Supabase (navegador)
  supabase-server.ts            Cliente Supabase (server)
supabase/
  schema.sql                    Tablas + RLS + storage (el corazón del sistema)
types/db.ts                     Tipos del dominio
middleware.ts                   Sesión + protección de /dashboard
```

## Puesta en marcha (≈10 minutos)

Necesitás una máquina con internet (este código no se puede instalar en el sandbox de Claude porque el registro de npm está bloqueado ahí).

1. **Crear proyecto en Supabase** → https://supabase.com (plan gratis alcanza para empezar).
2. En Supabase, ir a **SQL Editor** → pegar todo `supabase/schema.sql` → **Run**. Esto crea las tablas, la seguridad por gimnasio y el bucket de imágenes.
3. Copiar `.env.example` a `.env.local` y completar con **Project Settings → API** (URL y anon key).
4. Instalar y correr:
   ```bash
   npm install
   npm run dev
   ```
   Abrir http://localhost:3000
5. **Deploy** (cuando quieras publicarlo): subir el repo a GitHub e importar en **Vercel**; pegar las mismas variables de entorno. Listo, queda online.

## Auth (ya incluido)

- `/registro` — registro del dueño: crea la cuenta (rol `owner`), su gimnasio, la suscripción en trial de 14 días, y lo lleva a configurar la página.
- `/acceso` — login con **ruteo por rol**: owner → `/dashboard`, member → `/portal`, super_admin → `/admin`.
- `middleware.ts` protege `/dashboard`. La autorización de datos está en RLS.

## Subir a GitHub

El repo ya viene inicializado con un primer commit. Para publicarlo:

```bash
# creá un repo vacío en github.com (sin README), luego:
git remote add origin https://github.com/TU-USUARIO/gymcore.git
git branch -M main
git push -u origin main
```

Después, en Vercel: **New Project → Import** ese repo, pegá las variables de `.env.local`, deploy.

## Próximos pasos (roadmap)

1. **Panel del dueño**: socios (CRUD), rutinas (constructor), finanzas, clases, control de acceso — sobre el diseño del prototipo.
3. **Portal del socio (PWA)** instalable.
4. **Tu panel de super-admin** + **Stripe/Mercado Pago** para cobrar el abono a los dueños.
5. **Migración de datos** desde Bubble.

## Nota sobre seguridad

Toda la autorización crítica está en la base de datos (RLS), no solo en la interfaz. Aunque alguien intente pegarle a la API directamente, no puede leer datos de otro gimnasio. Este es el cambio más importante respecto de la versión de Bubble.
