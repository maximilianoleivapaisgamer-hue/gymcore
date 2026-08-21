-- ⚠️ RECONSTRUIDA: estas dos columnas YA EXISTEN en producción.
-- Aparecieron comparando el esquema real de Supabase contra los archivos del
-- repo (2026-08-21): estaban aplicadas a mano y nunca se habían versionado.
-- Se dejan acá para que un entorno nuevo (o una restauración) quede igual que
-- producción. Es idempotente: correrla contra la base actual no cambia nada.

-- Forma de pago de un movimiento de caja (efectivo, transferencia, etc.).
-- La usa app/dashboard/finanzas.
alter table public.cashflow_entries
  add column if not exists method text;

-- Ícono propio del gimnasio para la app instalable del socio.
-- OJO: hoy la columna está en la base pero NINGUNA parte del código la lee ni
-- la escribe. La PWA usa un manifest global (public/manifest.json), no uno por
-- gimnasio. Queda versionada para no perderla, pero la función de "ícono por
-- gimnasio" está SIN implementar. Ver §9 del CLAUDE.md.
alter table public.gyms
  add column if not exists app_icon_url text;
