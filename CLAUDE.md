# TurnoGym — Contexto del proyecto (para Claude Code)

> Este archivo es la fuente de verdad para trabajar el desarrollo de TurnoGym.
> Está pensado para que Claude Code entienda TODO el proyecto sin tener que
> redescubrirlo. La parte de **negocio/marketing/decisiones** se trabaja en Claude
> (Cowork); la parte de **código** se trabaja acá con Claude Code.

---

## 1. Qué es TurnoGym

SaaS multi-gimnasio (multi-tenant) para dueños de gimnasios y personal trainers.
En un solo lugar el dueño gestiona socios, cobros, clases, rutinas y dietas; cada
socio tiene su propia "app" (web instalable) con rutina, dieta, clases, progreso y
carnet QR; y cada gimnasio tiene su página pública white-label con su marca.

- Producción: **turnogym.com**
- Mercado: Argentina. Toda la interfaz en **español rioplatense** ("vos").
- Precios en **pesos argentinos**, mensuales.

---

## 2. Stack y cómo se despliega (LEER SIEMPRE)

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS.**
- **Supabase** (Postgres + Auth + Storage + RLS) como backend.
- **Vercel** para el hosting (deploy automático del branch `main`).
- **Mercado Pago** para cobros. **WhatsApp Cloud API (Meta)** para recordatorios.
- IA de Anthropic para generar rutinas/dietas y traducir la librería de ejercicios.

### Flujo de despliegue (IMPORTANTE)
1. Claude Code edita los archivos **localmente** en la máquina del dueño.
2. El dueño corre **`actualizar-github.bat`** (hace `git add` + `commit` + `push`).
3. Vercel detecta el push a `main` y **deploya solo**.
4. **Las migraciones de Supabase NO se aplican solas.** Cada archivo nuevo en
   `supabase/migration_XXX.sql` hay que **correrlo a mano** en el SQL Editor de
   Supabase. Si un cambio de código depende de una columna/tabla nueva, avisar de
   correr el SQL **antes** de deployar.

> Regla de oro: si tocás la base, siempre dejás (a) el archivo `migration_XXX.sql`
> y (b) un aviso claro de "corré este SQL en Supabase antes de subir".

### La landing de ventas
Vive en `public/landing.html` (un solo HTML autocontenido, con su tipografía de
Google Fonts y sus íconos SVG inline). `next.config.mjs` reescribe `/` hacia
ella, así que **turnogym.com muestra la landing** y todo lo demás lo sigue
sirviendo la app. Se deploya con el mismo push de siempre.
- Los CTA no tienen `href` en el HTML: se los asigna el script al cargar
  (`REGISTRO_URL` y el link de WhatsApp, arriba de todo en el `<script>`). Si
  ves `href="#"` en el fuente, **no está roto**.
- `app/page.tsx` sigue existiendo como respaldo, pero no se ve: la reescritura
  gana. Si algún día la landing se muda a un proyecto aparte, se setea
  `LANDING_URL` en Vercel y esa gana sin tocar código.

### Verificar el build ANTES de pushear
El typecheck (`npx tsc --noEmit`) no agarra todo: hay errores que solo aparecen
al compilar (imports rotos, mezclar servidor con cliente, exports de ruta mal).
Para correr el build hace falta que existan las variables públicas de Supabase;
el `.env.local` que deja `vercel link` viene **sin valores** (Vercel no los
devuelve descifrados). Con valores de mentira alcanza para verificar que
compile, porque las páginas piden los datos recién en el navegador:

```
NEXT_PUBLIC_SUPABASE_URL="https://ejemplo.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY="clave-de-mentira" npm run build
```

Ojo: eso sirve para **compilar**, no para `npm run dev`. Para levantar la app
localmente de verdad hay que poner los valores reales en `.env.local`
(Supabase → Settings → API; las dos son públicas, viajan al navegador igual).

> Antes esto no se podía: la carpeta se llamaba `TURNOGYM #` y el `#` rompía el
> rastreador de archivos de Next (`path must be a string without null bytes`).
> Se renombró a `TURNOGYM` el 2026-08-24. No uses `#`, `&` ni `%` en nombres de
> carpetas de proyectos.

**Numeración de migraciones:** ya no hay huecos. Los archivos `027`, `028` y
`029` faltaban en el repo pero los cambios **sí estaban aplicados** en la base
(figuran en `supabase_migrations.schema_migrations` como `admin_team_helpers`,
`gyms_is_test_flag` y `app_config_table`). Se reconstruyeron el 2026-08-21 con
el SQL real leído de la base. La `035` recupera dos columnas más que estaban
aplicadas a mano y sin versionar (`cashflow_entries.method`, `gyms.app_icon_url`).
El `001` sí no existe: la serie arranca en `002`.
La numeración siguiente arranca en **047**.

> Las migraciones marcadas "⚠️ RECONSTRUIDA" ya están aplicadas en producción;
> son idempotentes y sirven para levantar un entorno nuevo desde cero. La `028`
> tiene un `update` comentado que **no hay que descomentar** (marcaría a todos
> los clientes como prueba).

---

## 3. Arquitectura multi-tenant

- Cada gimnasio es un **tenant** (`gyms`). Todo cuelga de `gym_id`.
- **Auth / cuentas:**
  - Los dueños y socios se crean como usuarios de Supabase Auth.
  - Las cuentas generadas por la plataforma usan un **email sintético**:
    `usuario@socios.gymcore.app`. El "usuario" es la parte antes de la `@`.
    Al crearse, la **contraseña suele ser igual al usuario** (se avisa que la
    cambien desde "Mi cuenta").
  - `profiles.role`: `super_admin` (vos), dueño, staff. `is_super_admin()` es una
    función SQL usada por RLS.
- **RLS activo**: cada gimnasio ve solo lo suyo; el super admin ve todo. Las
  operaciones sensibles del servidor usan el **service-role key** (ver §7).

### Tablas clave
- `profiles` — `id`, `gym_id`, `role`, `full_name`, `permissions text[]`.
- `gyms` — tenant + config de la landing. Columnas relevantes:
  `owner_id, name, slug, logo_url, hero_url, accent_color, theme, bg_style,
  tagline, description, benefits[], member_plans jsonb, real_plans jsonb,
  whatsapp, address, landing_config jsonb, is_demo, is_test, archived,
  wa_phone_id, wa_reminders, wa_days_before, app_icon_url, hidden_sections text[],
  hidden_member_sections text[], extra_features text[]`.
- `subscriptions` — suscripción del dueño al SaaS: `gym_id, plan (basico|pro|elite),
  status (trial|active|past_due|canceled), trial_ends_at, current_period_end,
  payment_method (transferencia|mercadopago|null), mp_preapproval_id`.
- `members` — socios del gimnasio: `gym_id, full_name, dni, email, whatsapp,
  plan_name, plan_price, membership_expiry, height_cm, linked_user_id,
  reminder_whatsapp, reminder_email, member_number, last_reminder_at,
  last_reminder_for`. (El socio entra con **DNI** como usuario y clave.)
- `routines` / `routine_blocks` / `exercises` — rutinas + librería de ejercicios
  (con `primary_muscles[]`, `source`, demostración foto inicio/fin).
- `diets` / `diet_meals` — dietas por día/tipo de comida, con fotos.
- Clases y reservas (agenda + bookings).
- `plan_configs` — planes editables por el super admin (ver §4).
- `platform_settings` (id=1) — `transfer_alias, transfer_cbu, transfer_holder,
  transfer_note, support_whatsapp` y tokens de integraciones.
- `app_config` — key/value, **solo service-role** (tokens de Apify/Google, etc.).
- `demo_visits` — tracking de visitas a demos.

---

## 4. Planes y gateo de funciones — `lib/plans.ts`

- `PlanFeature = "clases" | "dietas" | "control_acceso" | "ia" | "whatsapp"`.
- Cada plan tiene `capabilities: PlanFeature[]`. La app pregunta
  `allows(plans, plan, feature, extras)` para habilitar/bloquear una función.
- **Funciones bonificadas por gimnasio** (`gyms.extra_features text[]`): le
  habilitás a UN cliente algo que su plan no trae, sin subirlo de plan ni tocar
  `plan_configs`. Se cargan desde Super Admin → botón **Funciones** en la fila
  del gimnasio (`action: "features"` en `api/admin/gimnasios`). Las bonificadas
  solo SUMAN: nunca sacan algo que el plan ya incluye.
  - `allows(plans, plan, feature, extras)` → el 4º parámetro es opcional; si no
    se pasa, resuelve solo por plan (compatible con llamadas viejas).
  - `isBonificada(plans, plan, feature, extras)` → true solo si se la regalaste
    (el plan NO la trae). Sirve para los carteles.
  - `loadGymExtras(sb, gymId)` → lee la columna. **Best-effort a propósito**: si
    todavía no se corrió `migration_034` devuelve `[]` en vez de romper.
  - Dónde se ve: en el menú del panel sale un chip verde **Extra** en vez del
    candado, y en **Mi plan** un bloque "Funciones bonificadas" con 🎁.
  - Requiere haber corrido `migration_034_funciones_bonificadas.sql`.
- Los planes **reales** se leen de la tabla `plan_configs` con `loadPlans(sb)`;
  si la base está vacía cae a `DEFAULT_PLANS` (respaldo hardcodeado).
- El menú muestra un candado con `minPlanLabel(plans, feature)` (etiqueta del plan
  más barato que incluye la función).

**Estado actual de capabilities:**
- `basico`: `clases`
- `pro`: `clases, dietas, control_acceso, whatsapp`
- `elite`: `clases, dietas, control_acceso, ia, whatsapp`

Precios actuales: Básico **$49.000**, Pro **$79.000**, Elite **$119.000**
(promo primer mes $90.000). Editables desde el panel Super Admin → Planes, que
escribe en `plan_configs`.

> ⚠️ Si agregás una feature nueva, hay que tocar **3 lugares**: el type
> `PlanFeature` + `DEFAULT_PLANS` en `lib/plans.ts`, y un `UPDATE` a
> `plan_configs` (SQL) porque los gimnasios reales usan la base, no los defaults.

---

## 5. Módulos / features implementados

### Panel del dueño — `app/dashboard/*`
Menú (con grupos): Dashboard, Socios, Rutinas, Dietas (Pro), Finanzas, Clases,
Equipo, Sucursales, Control de acceso (Pro), Planes, Página pública,
**Recordatorios automáticos** (WhatsApp, Pro), **Configuración**, Super Admin,
Mi plan, **Mi cuenta**.
- El menú y las páginas se gatean por plan con `allows()` (candado "Pro").
- **Configuración** (`app/dashboard/ajustes`): junta en una sola pantalla el
  **estilo de la app** (los 5 presets + fondo del panel) y las **secciones**
  (qué se prende y qué se apaga, para el dueño y para sus socios). Un solo
  Guardar para todo. Se unificaron porque el dueño busca las dos cosas en el
  mismo momento ("quiero acomodar mi panel").
  - Las claves ocultas van en `gyms.hidden_sections` y `gyms.hidden_member_sections`.
    Las secciones núcleo (Dashboard, Socios, Mi plan, Mi cuenta) no se apagan.
  - `app/dashboard/secciones` quedó como **redirección** a `ajustes`.
  - ⚠️ La pantalla de **Página pública** (`app/dashboard/configuracion`, mal
    nombrada de antes) ya NO guarda `theme` ni `bg_style`: si los guardara,
    pisaría lo que el dueño eligió en Configuración. Solo lee `theme` para
    previsualizarse con sus colores.
- **Mi cuenta** (`app/dashboard/cuenta`): cambiar usuario/contraseña + subir el
  **ícono de la app** (`gyms.app_icon_url`) para la PWA del socio.

### Cobros: cuándo vence la cuota y recargo por atraso
Cada negocio elige **cómo cobra**, desde Configuración → Cobros
(`gyms.cobro_modo`, `cobro_dia`, `recargo_tipo`, `recargo_valor`, `migration_041`).

- **`aniversario`** (default, el de gimnasio): al cobrar suma un mes al
  vencimiento del socio. Cada uno tiene su fecha. Si ya venció, cuenta desde hoy.
- **`dia_fijo`** (estudios que cobran "del 1 al 10"): a todos les vence el mismo
  día del mes. Si está al día, el mismo día del mes siguiente. Si venció, la
  próxima vez que caiga ese día — así al que paga muy tarde **no se le regala un
  mes**.
- **Recargo por atraso**: `null` (ninguno), `monto` (pesos) o `porcentaje`. Se
  **sugiere** al cobrarle a un socio atrasado, sumándolo al monto; el dueño lo
  puede pisar. Nunca se cobra solo.
- Todo vive en `lib/fechas.ts` (`nuevoVencimiento`, `recargoDe`, `estaAtrasado`)
  para que Finanzas y la ficha del socio calculen igual.

- **A qué mes corresponde la cuota**: al cobrar se elige el mes y queda en el
  concepto ("Cuota Septiembre 2026 — Silvina"), así el historial de pagos dice
  qué mes se pagó. Por defecto viene el mes que cubre ese pago.
- **Clases sueltas** (`gyms.clase_suelta_activa`, `clase_suelta_precio`,
  `migration_042`): se prenden en Configuración → Cobros con un precio sugerido.
  Aparece "Vender clase suelta" en la ficha del socio; trae el precio puesto
  pero se puede pisar (no todas valen lo mismo). **No le mueve el vencimiento**:
  es una clase extra, no una cuota. Sirve igual si el socio está al día o si debe.
  - Al venderla se elige si **le suma un cupo** (`members.clases_extra`,
    `migration_043`) o no. Con cupo, el socio la ve y la reserva desde su app;
    sin cupo solo se registra la plata (es la clase de hoy, ya está en la puerta).
  - El cupo extra **se suma al tope del plan** en el trigger y **se acumula**:
    no se borra al renovar la cuota (`migration_044`). Si compró una clase y no
    llegó a usarla, la conserva. La primera versión los reseteaba al renovar; se
    cambió porque el socio perdía algo que ya había pagado.
    **No caducan**, y es a propósito (decidido el 2026-08-27). Si algún día se
    acumulan de más, la ficha los muestra y el dueño decide; no agregar
    vencimiento sin que lo pidan.
  - ⚠️ El cupo sube el TOPE, no habilita una actividad que el plan excluye. Si le
    vendieron una clase de algo que su plan no cubre, la anota el dueño desde
    Clases (donde puede pasarse).

## Vencimientos y pruebas en el panel de admin

`isProximoVence` / `isVencido` miran **solo los `active`**. La prueba gratis
dura 7 días y la ventana de aviso también era de 7, así que **toda cuenta nueva
aparecía en "Abonos por vencer" el día que se registraba**, mezclada con los
clientes que pagan. Las pruebas tienen sus propios helpers
(`isTrialPorTerminar`, a 2 días del final, e `isTrialVencido`) y su propio
bloque en el dashboard.

La tabla de Gimnasios lista los `active` **y los `trial`**: antes solo mostraba
activos, así que se avisaba arriba que una prueba se terminaba y abajo ese
gimnasio no figuraba en ningún lado, sin forma de convertirlo ni borrarlo.

## No reservar más allá del vencimiento

`gyms.reserva_hasta_vencimiento` (`migration_051`), en Configuración → Reservas
de clases. Salió de abrir el mes entero: con el calendario largo, un socio se
anota a clases de dentro de tres semanas sin haber pagado ese mes. El tope del
pack no lo frena, porque cuenta contra el ciclo al que corresponde cada fecha.

- Arranca **apagado**. DanzArte lo tiene prendido desde el 2026-09-01.
- Lo aplica el trigger `enforce_booking_expiry` (before insert on `bookings`),
  igual que el tope de clases: el socio inserta directo desde el navegador.
- **Solo frena al socio.** El dueño anota a quien quiera desde Clases.
- Un socio **sin `membership_expiry` cargado no se frena**: no hay contra qué
  comparar, y hay gimnasios que no llevan vencimientos.
- ⚠️ Consecuencia: para un socio YA vencido, todas las fechas son posteriores,
  así que no puede reservar nada hasta pagar. En un negocio donde se paga unos
  días tarde (DanzArte cobra recargo desde el día 10), eso lo deja afuera esos
  días. Si molesta, se agrega un margen de días; no se saca la regla.

## Cancelar una clase

`gyms.cancelacion_activa` + `gyms.cancelacion_horas` (`migration_049`), en
Configuración → **Reservas de clases**. Lo pidió DanzArte: *"si quiere cancelar
tiene hasta 2 hs antes; y si estaba anotada y no fue, perdió una clase"*.

- Arranca **apagado** para todos, así no le cambia las reglas a nadie que ya
  venía andando. DanzArte lo tiene en 2 horas desde el 2026-09-01.
- **"Perder la clase" no necesita código extra**: si el socio no puede cancelar,
  la reserva queda, y el tope del plan cuenta las reservas del ciclo haya ido o
  no. Ese es todo el mecanismo.
- Lo aplica el trigger `enforce_cancel_window` (before delete on `bookings`), no
  la pantalla: el socio borra la reserva directo contra Supabase desde el
  navegador. La pantalla solo evita ofrecer un botón que va a fallar.
- **Solo frena al socio** (`profiles.role = 'member'`). El dueño y los profes
  sacan a alguien de una reserva cuando quieran, igual que con el tope de clases.
- La hora de corte se calcula en `America/Argentina/Buenos_Aires`. Una clase sin
  `start_time` cuenta como que arranca a las 00:00 de ese día.

## La grilla de clases

**El socio la ve por día, no por horario.** La tabla `classes` guarda una fila
por horario, así que un estudio con cuatro Zumbas tenía cuatro filas "Zumba"
salteadas por la lista: la socia la veía arriba y otra vez más abajo. Desde el
2026-09-01 el portal muestra solapas de días (solo los que tienen clases, con
el número al lado) y abajo únicamente lo de ese día, ordenado por hora.

- Arriba de las solapas hay flechas de **semana**. Hasta dónde llegan lo elige
  cada negocio en Configuración → Reservas de clases (`gyms.reserva_semanas`,
  `migration_050`). El número **incluye la semana en curso**: 1 = solo esta
  semana, 4 = un mes. El default es 3, que es como venía funcionando.
  DanzArte lo tiene en 4 desde el 2026-09-01, pidió abrir el mes entero.
- La solapa arranca en **hoy**; los días que ya pasaron quedan apagados y no se
  pueden tocar. Al cambiar de semana cae en el primer día disponible.
- Las solapas usan `flex-1`, no scroll horizontal: en un iPhone SE (375 px) el
  sábado quedaba cortado y no se veía.
- **Todas las clases de una solapa comparten la misma fecha**, que es la que se
  guarda en `bookings.class_date`. Antes cada fila resolvía su propia "próxima
  fecha" por separado.
- Una clase de **hoy que ya empezó** no se puede reservar: el botón dice
  "Ya pasó". Se compara contra la hora actual, no contra la fecha.
- Si se toca esta pantalla, ojo con los **nombres con espacios de más**
  (`"Zumba "`, `" Maria"`): hay varios cargados así en producción. Cualquier
  cosa que agrupe por actividad tiene que normalizar con `trim()` + minúsculas,
  como ya hacen `clasesALanding()` y el trigger de límite de clases.

**Foto por clase** (`classes.image_url`, `migration_047`): la sube el dueño
desde el modal de Clases al bucket público `gym-assets` (el mismo del logo),
y el socio la ve al lado del nombre.

Es opcional, y **se resuelve sola**: si el estudio no cargó foto en NINGUNA
clase, ni el panel ni la app muestran el recuadro, así que la lista queda igual
de prolija que antes. Si cargó en algunas, las que no tienen muestran la
inicial de la clase en su color (`inicialDe()`). No hace falta una opción para
apagarlo: no hay fotos, no hay recuadros.

**Vista semanal para el dueño**: en Clases, arriba a la derecha, un interruptor
"Tarjetas / Semana". La semana ubica cada clase según hora y duración, así los
huecos libres se ven como espacios en blanco. Las clases que se pisan se
reparten en carriles para que no se tapen. La elección se guarda en
`localStorage` (`tg_clases_vista`).

> ⚠️ **TODO lo que el panel filtre por sucursal necesita `sede_id` al
> insertarse.** Pasó dos veces:
> - `cashflow_entries` sin sede → $140.000 invisibles en el dashboard y Finanzas.
> - `bookings` desde el portal del socio sin sede (`migration_048`) → DanzArte
>   tenía 13 socias anotadas y todas las tarjetas de Clases decían "0 / 20",
>   porque el panel filtra las reservas por sede. La sede de una reserva sale
>   de la clase (`classes.sede_id`).
> Pasó de verdad — 3 cobros de 2 clientes, $140.000 invisibles, porque el alta
> de socios insertaba sin `sede_id`. Se backfilleó y se arreglaron los 4 inserts.
> Además las dos lecturas ahora incluyen `sede_id is null`, para que si alguien
> vuelve a olvidarse la plata se vea igual en vez de desaparecer callada.

> ⚠️ **Cobrar TIENE que renovar el vencimiento.** Durante un tiempo registrar un
> pago solo insertaba el movimiento en `cashflow_entries` y `membership_expiry`
> quedaba igual: el dueño cobraba, veía la plata, y al socio le seguía figurando
> "Vencido". Una clienta llegó a cargar el pago dos veces por eso. Si tocás un
> flujo de cobro, asegurate de que corra la fecha.

### Tope de clases por plan
Cada plan de socio (`gyms.real_plans`) puede tener `class_limit`: cuántas clases
incluye por ciclo. Vacío/0 = **ilimitado** (ej: "Pase Libre"). Lo carga el dueño
en `/dashboard/planes`, campo "Clases".

- **Quién frena de verdad: el trigger `trg_enforce_class_limit` en `bookings`**
  (`migration_038`). Va en la base y no en la pantalla porque el socio reserva
  **directo desde el navegador** contra Supabase — no hay API en el medio, así
  que un control solo en el front se esquiva.
- **El ciclo** son los 30 días de la cuota de CADA socio, anclados a
  `members.membership_expiry` (vence el 20/09 → ciclo del 20/08 al 20/09). Sin
  vencimiento cargado, cae al mes calendario.
- **Solo frena al socio.** El dueño y los profes pueden pasarse desde el panel de
  Clases (para regalar una clase o cobrar una suelta); les sale un `confirm` que
  avisa, pero los deja.
- Los nombres de plan se comparan con `trim`+`lower`: los cargados a mano vienen
  con espacios de más ("PACK 1 ").
- **Qué actividades incluye el plan** (`migration_039`): además del tope, cada
  plan tiene `clases_modo` (`todas` | `excepto` | `solo`) y `clases_lista`
  (nombres de actividades). Caso real de DanzArte: el "Pase Libre" es
  `excepto ["Kangoo Jumps"]` y el plan "Kango Jumps" es `solo ["Kangoo Jumps"]`
  (el Kangoo se hace con botas que pone el estudio, va aparte).
  - **Se guarda el NOMBRE de la actividad, no el id de la clase.** El dueño carga
    una fila por horario (DanzArte tiene 4 de "Zumba"), así que por nombre la
    regla vale para todos los horarios, incluidos los que agregue después. La
    contra es que si renombra una actividad el plan deja de matchear: por eso la
    pantalla de Planes avisa cuando un plan apunta a algo que ya no existe.
  - En el editor se listan las actividades **únicas** del gimnasio
    (`actividadesUnicas()` agrupa los horarios repetidos). El dueño no escribe
    nada: tilda de una lista de lo que él mismo ya cargó.
- `lib/cupo-clases.ts` repite la misma cuenta en el front, **solo para mostrar**
  ("te quedan 3 de 8", "No incluida"). ⚠️ Si tocás una, tocá la otra: tienen que
  coincidir con el trigger.

### Portal del socio — `app/portal/*`
La "app" del socio: rutina, dieta, clases/reservas, peso, progreso, carnet QR.
Se **instala como PWA** (web a pantalla de inicio) con `components/InstallAppButton.tsx`.

> ⚠️ Corregido el 2026-08-21: el manifest es **global** (`public/manifest.json`),
> NO por gimnasio. `app/manifest/[slug]/route.ts` y `components/PwaBranding.tsx`
> **no existen** (nunca estuvieron en el repo, verificado contra el historial de
> git). La columna `gyms.app_icon_url` existe en la base pero no la lee ni la
> escribe ninguna parte del código.

### Sincronizar la grilla de clases con la web
`landing_config.clases_sync` (bool, por defecto **false**). Con eso prendido, la
web pública NO usa la lista de clases cargada a mano: lee **en vivo** la tabla
`classes` del gimnasio y la convierte con `clasesALanding()` de `lib/clases.ts`.

- Se lee en vivo y no se copia: si el dueño agrega una clase en el panel,
  aparece en la web sola. Dos listas separadas se desincronizan siempre.
- Se prende desde Página pública → Clases. Con el interruptor activado, el
  editor manual se reemplaza por la lista de solo lectura de lo que hay en el
  panel, y la vista previa muestra lo mismo.
- `lib/clases.ts` centraliza `DAYS`, `dayLabels()` y `fmtTime()`, que antes
  estaban duplicados en el panel de Clases.
- Por defecto viene apagado a propósito: prenderlo le cambiaría la web a un
  cliente que ya la tenía cargada a mano.
- ⚠️ **La web la mira gente anónima**, así que sin permiso la grilla llega VACÍA
  y sin ningún error visible. Probá siempre la página **deslogueado**: logueado
  como dueño anda igual y no te enterás.
  **La solución NO es abrir la tabla en RLS.** Se probó (`migration_045`) y
  reventó todo — ver el gotcha de aislamiento en §10. La grilla se lee desde el
  SERVIDOR con el service role en `app/(public)/[slug]/page.tsx`, acotada a ese
  gimnasio y a 4 columnas.

### Página pública / landing — `app/(public)/[slug]` y `/g/[slug]`
Landing white-label por gimnasio: logo, portada, galería, colores/tema, dirección
con Google Maps, planes de socio, beneficios. Editable desde
`app/dashboard/configuracion`. Tiene modo **personal trainer** (copy adaptado).

### Demos (para vender) — `app/demo/*` y `app/api/admin/demo/*`
- Generador de demos (`admin/demo/generar`): crea un gimnasio de ejemplo con 5
  socios, dirección real (Google/Apify), fotos, etc.
  - **Lo ÚNICO obligatorio es el nombre.** Google Maps/Apify es opcional: si el
    local no está cargado en Google (pasa seguido con los que recién abren), se
    escribe la dirección a mano y la IA arma la web igual con el nombre, la
    ciudad y el texto libre.
  - **Requiere saldo en la cuenta de Anthropic.** Sin crédito, la IA devuelve
    400 `credit balance is too low` y no se genera nada.
  - Las **clases del panel** salen de las que inventó la IA para ese rubro
    (`clasesDesdeIA()` en `lib/demo-seed.ts` convierte "Lunes y miércoles" +
    "18.30hs" al formato de la tabla `classes`). Antes el panel se llenaba
    siempre con una lista fija de gimnasio, así que un estudio de pilates veía
    "Boxeo" y "Crosstraining" en su agenda mientras la web mostraba pilates.
    Si la IA no devuelve nada usable, cae a la lista de siempre.
  - Sin fotos de Google se usan fotos de ejemplo elegidas **según el rubro**
    (`stockPara()` en `lib/stock-images.ts`): detecta pilates, yoga, danza,
    crossfit, box, natación, spinning y artes marciales por el nombre y la
    descripción. Antes eran siempre de sala de pesas, y una demo de pilates con
    fotos de crossfit no se vende.
- **Módulos de la demo**: en el formulario tildás qué secciones muestra
  (`body.secciones` = las claves VISIBLES de `lib/sections.ts`). El endpoint
  guarda lo inverso en `gyms.hidden_sections` y, para la app del socio, en
  `gyms.hidden_member_sections` (mapeo `rutinas→rutina`, `dietas→dieta`,
  `clases→clases`). Hay presets: **Todo**, **Estudio de clases** (pilates/yoga:
  clases + planes + finanzas + página pública) y **Personal trainer**.
  Si no se manda `secciones`, la demo muestra todo (comportamiento de antes).
  El dueño después lo puede cambiar desde "Secciones".
- Demo **sin login**: un link donde el prospecto entra "como dueño" o "como socio"
  (`app/demo/[slug]`, `app/demo/entrar`).
- Gestión de demos, credenciales, actividad, conversión a cliente.

### Activación / checkout — `app/activar/[slug]` + `app/api/pagos/*`
El prospecto que probó la demo paga y su gimnasio se activa solo:
- **Suscripción** (débito automático) → MP `preapproval`.
- **Un pago** (Checkout Pro) → MP `preference`.
- **Transferencia** (alias/CBU) → la aprueba el super admin a mano.
- El **webhook** (`app/api/pagos/webhook`) convierte la demo en cliente real y
  activa la suscripción (1 mes). Tras pagar se muestran las credenciales.

### Cobros / Super Admin — `app/admin/*`
- Dashboard de gimnasios **reales** (`is_demo = false`): plan, estado, método,
  vencimiento (editable a mano), socios, y acciones: Avisar (WhatsApp), Ver
  página, Marcar/quitar prueba, Pasar a cliente real (Transferencia/MP/Sin cobro),
  **Accesos** (ver/reiniciar usuario y clave del dueño), Archivar, Eliminar.
- **Entrar como el cliente** (`api/admin/entrar?gym=<id>&rol=owner|socio`): desde
  la fila del gimnasio, "Entrar: dueño / socio". Abre la sesión de esa cuenta sin
  pedir la contraseña, generando un magic link con la API de admin de Supabase y
  canjeándolo en el servidor (`verifyOtp`); si falla, cae al viejo truco de las
  demos (clave == usuario). Nunca deja entrar a otro super admin.
  - **Reemplaza tu sesión de super admin.** Por eso deja dos cookies: la de
    `tg_viendo_como` (la lee `components/ViendoComo.tsx` para el cartel flotante)
    y `tg_volver` (httpOnly, 8hs, tu user id) para que `api/admin/volver` te
    restaure la sesión de un click. Al volver se re-chequea que ese id siga
    siendo `super_admin`.
  - El cartel se monta en `app/dashboard/layout.tsx` y `app/portal/layout.tsx`.
- Los gimnasios marcados **prueba** (`is_test`) no cuentan para la plata/métricas.
- Librería de ejercicios: botón para cargar/traducir 800+ ejercicios con IA.

### Recordatorios por WhatsApp — `app/dashboard/whatsapp` + `app/api/whatsapp`
- Función **Pro**. Avisa a los socios que deben, **desde el número del propio
  gimnasio** (token central de Tech Provider + `phone_number_id` por gym en
  `gyms.wa_phone_id`). Config: número, on/off, días antes, y "enviar prueba".
- En Básico la pantalla ofrece el recordatorio **manual** desde Socios.
- La **etapa 2** (cron diario que los manda) ya está hecha: ver §9.

---

## 6. Estructura del repo (orientativa)

```
app/
  (public)/[slug]/      landing pública white-label
  g/[slug]/             variante pública / demo pública
  dashboard/            panel del dueño (layout.tsx define el menú y el gateo)
    socios, rutinas, dietas, finanzas, clases, equipo, sedes,
    control-acceso, planes, configuracion (= Página pública), whatsapp,
    ajustes (= Configuración), cuenta, mi-plan
  portal/               app del socio (rutina, dieta, clases, peso, progreso)
  admin/                super admin (page.tsx = dashboard de cobros)
  activar/[slug]/       checkout público de activación
  acceso/               login
  api/
    whatsapp/           config de recordatorios del dueño
    cron/whatsapp/      cron diario que manda los recordatorios (Vercel Cron)
    cuenta/             cambiar usuario/clave del dueño logueado
    pagos/{activar,webhook}/   Mercado Pago
    admin/{gimnasios,cobros,transferencia,equipo,config,exercises}/
    admin/demo/{generar,convertir,credenciales,acceso,publica,gestion,...}
components/    PasswordInput, AiChat, ThemeApply, ThemePicker, PreviewSocio,
              AppBackground, ViendoComo, InstallAppButton, ...
lib/          plans.ts, admin.ts, mercadopago.ts, whatsapp.ts, google-places.ts,
              supabase-browser.ts, supabase-server.ts
supabase/     schema.sql + migration_0XX_*.sql (correr a mano)
```

---

## 7. Convenciones de código

- **Route handlers** (`route.ts`): `export const runtime = "nodejs"`. Tres clientes
  de Supabase según el caso:
  - `supabase-browser` → componentes cliente (respeta RLS del usuario).
  - `supabase-server` → SSR / leer el usuario logueado.
  - `createAdmin(URL, SERVICE_ROLE_KEY, {auth:{persistSession:false}})` →
    operaciones privilegiadas (saltea RLS). Nunca exponer el service-role al cliente.
- **UI en español rioplatense**, tono cercano. Nada de inglés en la interfaz.
- **Links de WhatsApp**: en los PANELES (super admin y panel del dueño) usar
  `lib/wa-link.ts` — `target={WA_TARGET}` + `onClick={(e) => abrirWhatsapp(e, tel, msg)}`.
  Eso hace dos cosas: en la compu va directo a `web.whatsapp.com` (saltea la
  pantalla de "Abrir aplicación / Continuar en WhatsApp Web") y reutiliza SIEMPRE
  la misma pestaña en vez de abrir una nueva por cada aviso. En celular sigue
  usando `wa.me`, que abre la app.
  ⚠️ En la **landing pública** y en el **portal del socio** NO se usa: ahí entra
  gente desde el celular y `wa.me` es lo correcto.
- **Estilos de la app (5 presets) — `lib/theme.ts`.** Cada estilo cambia la
  paleta ENTERA (fondo, superficies, textos y marca), no solo el acento: por eso
  se sienten distintos y no como el mismo diseño repintado. Los cinco mantienen
  la base oscura tipo "tech app"; lo que cambia es su temperatura.
  - `celeste` (Cian, el default) · `rosa` (pilates/yoga) · `fucsia` (danza) ·
    `verde` (funcional/crossfit) · `ambar` (musculación/box).
  - **Todos los tokens base son variables CSS** (`--surface-rgb`, `--ink-rgb`,
    `--muted-rgb`, …) que consume `tailwind.config.ts`. Cambiar de estilo
    repinta los ~830 usos de `bg-surface` / `text-ink-2` / `text-muted` solos.
    Van en formato "R G B" y no hex, para que Tailwind pueda aplicar alfa
    (`bg-bg/80`).
  - `ThemeApply` escribe las variables y guarda la clave en localStorage;
    `app/layout.tsx` la aplica con un script inline **antes del primer pintado**.
    Sin eso se ve un flash con el estilo por defecto — antes casi no se notaba,
    ahora que cambia el fondo entero canta muchísimo.
  - El color del texto del botón primario (`--on-brand`) es parte del preset:
    hay paletas donde el texto oscuro no llega al contraste mínimo contra los
    dos extremos del degradé (el fucsia con violeta daba 3.5 y hubo que abrirlo).
  - ⚠️ **Los textos van NEUTROS en los cinco.** Se probó tiñéndolos con el matiz
    de cada paleta (lo que suele recomendarse) y el dueño lo vio como "una capa
    rosa encima de las letras". Lo que se tiñe es el fondo y la marca, no el
    texto. No volver a teñirlos.
  - ⚠️ **Los contrastes están medidos, no elegidos a ojo.** Si tocás un color,
    volvé a medir: texto ≥4.5:1 sobre las tarjetas (incluida la superficie más
    clara) y el acento ≥3:1. De paso se corrigió `muted`, que en el tema viejo
    estaba en 3.75 (ilegible) en sus 209 usos.
  - Se elige desde el panel del dueño (**Configuración** → Estilo de la app) y
    desde el Super Admin en cada demo (Demos → Editar → Estilo de la app).
    El componente es `components/ThemePicker.tsx`, con preview real de cada
    paleta; se usa en los dos lados.
  - Al lado del selector va `components/PreviewSocio.tsx`: un teléfono que
    muestra la app del socio con ESE estilo, el nombre y el logo del negocio, y
    **solo las secciones que le dejó prendidas al socio**. Se dibuja con estilos
    inline y no con clases de Tailwind, porque tiene que mostrar el estilo que se
    está probando, no el que está aplicado.
  - ⚠️ **Un tema CLARO no entra con este esquema**: hay ~350 usos de `white/10`
    y `white/5` para bordes y fondos sutiles que asumen base oscura. Habría que
    tokenizarlos primero.
- **Design tokens de Tailwind** que ya existen (usarlos, no inventar colores):
  `card`, `btn btn-primary`, `btn btn-ghost`, `input`, `text-ink`, `text-ink-2`,
  `text-muted`, `text-brand`, `text-good`, `text-warn`, `text-crit`, `bg-brand`,
  `border-white/10`. Tema oscuro por defecto.
- **Un archivo por responsabilidad**; los componentes cliente arrancan con
  `"use client"`.
- Al agregar un ítem al menú que sea de un plan, poné `feature: "<cap>"` para que
  salga el candado.

---

## 8. Variables de entorno (Vercel)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (privada, solo servidor)
- `NEXT_PUBLIC_APP_URL` (ej: https://turnogym.com)
- `MP_ACCESS_TOKEN` (Mercado Pago; el mismo sirve para suscripción y para un pago)
- `ANTHROPIC_API_KEY` (IA de rutinas/dietas y traducción de la librería)
- `WHATSAPP_TOKEN`, `WHATSAPP_TEMPLATE` (ej: `recordatorio_cuota`), `WHATSAPP_LANG`
  (ej: `es` o `es_AR`)
- `CRON_SECRET` (string largo al azar). Protege `/api/cron/whatsapp`: Vercel Cron
  lo manda solo como `authorization: Bearer <secreto>`. **Si falta, el cron no
  corre** (falla cerrado, no manda nada).
- Tokens de Apify / Google Places: se cargan desde el panel (guardados en
  `app_config` / `platform_settings`), no siempre por env.

---

## 9. Estado actual y pendientes

- ✅ Gateo de WhatsApp a Pro (menú con candado + página + API). Requiere haber
  corrido `migration_032_whatsapp_pro.sql`.
- ⏳ **Ícono de la app por gimnasio**: NO está hecho, aunque este archivo decía
  que sí. La columna `gyms.app_icon_url` existe pero está huérfana: falta la
  subida en "Mi cuenta", el manifest por gimnasio y el componente que lo inyecte.
- ✅ Secciones configurables (`hidden_sections`).
- ✅ Botón **Accesos** en el admin para ver/reiniciar usuario y clave de cualquier
  gimnasio (demo o cliente real). Endpoints `admin/demo/acceso` y
  `admin/demo/credenciales` ya no exigen `is_demo`.
- ✅ Activación/conversión a cliente = **1 mes** (30 días), sin bono de +3 días.
  El "regalo de días" se hace **a mano** editando la fecha de Vence en el admin.
- ✅ **WhatsApp etapa 2**: cron diario que manda los recordatorios
  (`app/api/cron/whatsapp/route.ts` + `vercel.json`, schedule `0 12 * * *` UTC =
  9 AM de Argentina). No usa base nueva: se apoya en las columnas de
  `migration_030_whatsapp.sql`. Requiere `CRON_SECRET` en Vercel.
  - Recorre gimnasios con `wa_reminders=true` + `wa_phone_id`, **excluyendo**
    demos (`is_demo`), archivados y suscripciones `canceled`.
  - Gatea por plan con `allows(plans, plan, "whatsapp")`, con la misma
    salvaguarda que `app/api/whatsapp` (si ningún plan tiene la capacidad, no
    bloquea a nadie).
  - Avisa al socio cuya cuota vence en `<= wa_days_before` días o ya venció;
    respeta el opt-out `members.reminder_whatsapp`.
  - Anti-duplicado: uno por vencimiento vía `members.last_reminder_for`; se marca
    **después** de un envío exitoso (si falla, reintenta mañana).
  - Topes: `MAX_ENVIOS=200` por corrida y `MAX_DIAS_VENCIDO=30` (no persigue
    deudas más viejas que eso). Ambos son constantes arriba del archivo.
  - Un envío que falla se loguea y sigue con el próximo; devuelve un JSON con el
    resumen (útil para mirar en los logs de Vercel).
- ✅ **Funciones bonificadas por gimnasio** (`gyms.extra_features`). Requiere
  `migration_034_funciones_bonificadas.sql`.
- ✅ **Demos con módulos a medida**: elegís en el generador qué secciones ve el
  prospecto. No usa base nueva (se apoya en `hidden_sections` /
  `hidden_member_sections`, migraciones 031 y 033).
- ⏳ **Dashboard admin**: ya excluye demos (`is_demo=false`). A DEFINIR si además
  se quiere ocultar del listado principal los gimnasios en estado "prueba"/trial y
  mostrar solo los activos.
- ⏳ **PWA**: el nombre/ícono por gimnasio ya está; falta pulir instalación en iOS.
- ⏳ Cambiar el nombre del cobro en Mercado Pago (aparece el negocio de la cuenta
  MP; se cambia en la config de Mercado Pago, no en el código).

---

## 10. Gotchas (cosas que ya rompieron — no repetir)

- **Login roto al crear usuarios de Auth a mano:** GoTrue falla si quedan en NULL
  los campos de token. Al insertar en `auth.users`, poné `coalesce(..., '')` en
  `confirmation_token, recovery_token, email_change, email_change_token_new`.
- **No cambiar el dominio del email sintético** (`@socios.gymcore.app`) al editar
  un usuario: rompe el login. Solo cambiar la parte antes de la `@`.
- **Mercado Pago:** el `reason`/`title` de la suscripción tiene límite de **60
  caracteres** (truncar). El `payer_email` de un `preapproval` debe ser un email
  **real y distinto** al de la cuenta vendedora (con email falso o la propia cuenta
  tira 500).
- **plan_configs manda:** los gimnasios reales leen los planes de la base. Cambios
  de capabilities/precios hay que hacerlos por **SQL** además de en `DEFAULT_PLANS`,
  y correr el SQL **antes** de deployar (si no, un candado puede mostrar el plan
  equivocado).
- **Migraciones a mano:** ninguna migración se aplica sola. Ver §2.
- **`revoke ... from anon, authenticated` NO alcanza para cerrar una función.**
  En Postgres las funciones nacen con EXECUTE para el rol **PUBLIC**, y
  anon/authenticated heredan de ahí. Hay que hacer
  `revoke execute on function ... from public` y después `grant ... to service_role`.
  Esto ya mordió una vez: las funciones `admin_list_super_admins` y
  `admin_find_user_id_by_email` quedaron llamables por cualquiera desde
  `/rest/v1/rpc/...` durante un mes (arreglado en `migration_036`). Un
  `create or replace function` vuelve a darle EXECUTE a PUBLIC, así que si
  recreás una función, revocá de nuevo.
- **`is_super_admin()` y `current_gym_id()` NO se cierran**, aunque el linter
  las marque (0028/0029). Postgres chequea el permiso EXECUTE al evaluar una
  política RLS: si les revocás EXECUTE a `authenticated`, las 22 + 20 políticas
  que las usan explotan con "permission denied" y todos los dueños y socios
  pierden acceso a sus propios datos. Probado. Además no filtran nada: devuelven
  info del que llama. Ver `migration_037`.
- **NUNCA abrir una tabla con `using (true)` sin revisar quién la consulta.**
  Mordió fuerte: para que la grilla de clases se viera en la web pública se
  agregó lectura pública a `classes` (`migration_045`). Pero el portal del socio
  hacía `from("classes").select("*")` **sin filtrar por gym_id** — se apoyaba en
  RLS para aislarse. Resultado: los socios de un estudio vieron las clases de
  TODOS los gimnasios y demos, y la dueña reportó "clases que no existen".
  - Revertido en `migration_046`. Ahora las consultas filtran por `gym_id` A
    MANO (portal y panel) y la web pública usa el service role del lado del
    servidor.
  - **Regla:** el aislamiento entre clientes no puede depender de una sola capa.
    Filtrá por `gym_id` en la consulta AUNQUE la política ya lo haga. Antes de
    tocar una política, buscá todos los `from("<tabla>")` y fijate cuáles no
    filtran.
- **Correr `get_advisors` después de tocar la base.** El linter de Supabase
  agarra RLS faltante, funciones abiertas y search_path mutable. Es la forma
  rápida de no dejar un agujero.
- **Columnas nuevas en consultas grandes:** si agregás una columna a un `select`
  que ya existe (ej: el que trae todos los gimnasios) y todavía no se corrió el
  SQL, ese `select` falla ENTERO y tira la pantalla abajo. Por eso las columnas
  nuevas se leen en una **consulta aparte y best-effort** (así se hace con
  `hidden_sections` en el layout y con `extra_features` en el admin y el cron).
- **El proyecto compila con errores de tipos:** `next.config.mjs` tiene
  `typescript.ignoreBuildErrors: true`. Hay ~20 errores preexistentes por el
  salto de versión de `@supabase/supabase-js` (el código está escrito contra la
  2.45 y npm instala la 2.11x). No rompen en runtime, pero significa que **el
  build no te avisa si rompés un tipo**: conviene correr `npx tsc --noEmit` y
  comparar contra esa línea de base.
- No usar `localStorage`/`sessionStorage` en artifacts/embeds; en la app normal está
  ok, pero preferir estado en memoria o Supabase.

---

## 11. Cómo pedir cambios (para el dueño)

Con Claude Code, pedile en criollo lo que querés (ej: "sumá un botón X en el panel
de socios que haga Y"). Code va a:
1. Leer este `CLAUDE.md` y los archivos que toque.
2. Hacer el cambio + si toca la base, dejar el `migration_XXX.sql`.
3. Avisarte si hay que correr SQL en Supabase.
4. Vos corrés `actualizar-github.bat` para subir y Vercel deploya.

Cuando algo sea de **negocio, precios, textos de venta, estrategia o contenido**,
eso se trabaja en Claude (Cowork), no acá.
