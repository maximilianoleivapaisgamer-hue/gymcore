-- Cierra un agujero de seguridad detectado el 2026-08-21 por el linter de
-- Supabase (lint 0028 / 0029).
--
-- QUÉ PASABA: migration_027 hacía `revoke all ... from anon, authenticated`,
-- pero eso NO alcanza. En Postgres las funciones nacen con EXECUTE para el rol
-- PUBLIC, y anon/authenticated heredan de PUBLIC. El ACL real era
-- `=X/postgres` (PUBLIC con EXECUTE), así que cualquiera sin loguearse podía
-- pegarle a /rest/v1/rpc/admin_list_super_admins y llevarse los emails de
-- todos los super admins, o usar admin_find_user_id_by_email para averiguar si
-- un email existe y sacar su user id.
--
-- Hay que revocarle a PUBLIC, no a los roles.
--
-- No rompe la app: las dos funciones se llaman SOLO desde el servidor con el
-- service role (app/api/admin/equipo y app/api/cuenta), que conserva su grant
-- explícito.

revoke execute on function public.admin_find_user_id_by_email(text) from public;
revoke execute on function public.admin_list_super_admins() from public;

-- Explícito, para que quede claro quién puede y para que no dependa del
-- default si alguien recrea las funciones con `create or replace`.
grant execute on function public.admin_find_user_id_by_email(text) to service_role;
grant execute on function public.admin_list_super_admins() to service_role;

-- ⚠️ OJO al recrear estas funciones: un `create or replace function` vuelve a
-- darle EXECUTE a PUBLIC. Si tocás migration_027, volvé a correr esta.
