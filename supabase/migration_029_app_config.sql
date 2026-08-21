-- ⚠️ RECONSTRUIDA: esta migración YA ESTÁ APLICADA en producción.
-- Se aplicó el 2026-07-17 (registrada en supabase_migrations.schema_migrations
-- como "app_config_table") pero nunca se había guardado como archivo en el
-- repo. Se reconstruye acá tal cual quedó en la base. Es idempotente.

-- Configuración interna de la app (clave-valor). Guarda cosas como el token de
-- Apify para poder cambiarlo desde el panel sin tocar Vercel. Solo el servidor
-- (service role) puede leer/escribir: RLS activo y sin políticas para anon/auth.
create table if not exists public.app_config (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;
