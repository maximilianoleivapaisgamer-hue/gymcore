-- ⚠️ RECONSTRUIDA: esta migración YA ESTÁ APLICADA en producción.
-- Se aplicó el 2026-07-17 (registrada en supabase_migrations.schema_migrations
-- como "admin_team_helpers") pero nunca se había guardado como archivo en el
-- repo. Se reconstruye acá tal cual quedó en la base, para que el historial
-- versionado coincida con la realidad. Es idempotente: volver a correrla no
-- rompe nada.

-- Funciones de apoyo del panel Super Admin → Equipo.
-- Van con security definer porque necesitan leer auth.users, que no es
-- accesible desde el cliente. Por eso mismo se les revoca el permiso a anon y
-- authenticated: solo las puede invocar el servidor con el service role.

-- Buscar el id de un usuario por email (para promover a super admin).
create or replace function public.admin_find_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;

-- Listar los super admin actuales con su email (para el panel de Equipo).
create or replace function public.admin_list_super_admins()
returns table (id uuid, email text, full_name text)
language sql
security definer
set search_path = public, auth
as $$
  select p.id, u.email::text, p.full_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'super_admin'
  order by u.email;
$$;

revoke all on function public.admin_find_user_id_by_email(text) from anon, authenticated;
revoke all on function public.admin_list_super_admins() from anon, authenticated;
