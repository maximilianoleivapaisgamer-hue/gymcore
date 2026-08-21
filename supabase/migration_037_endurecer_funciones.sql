-- Cierra los avisos que quedaban del linter de Supabase (2026-08-21), pero
-- SOLO los que se pueden cerrar sin romper nada.
--
-- 1) handle_new_user y assign_member_number son funciones de TRIGGER. No hace
--    falta que nadie las pueda invocar por RPC: Postgres dispara los triggers
--    sin chequear el permiso EXECUTE. Verificado con una prueba en transacción
--    revertida (el trigger siguió asignando member_number con el permiso ya
--    revocado).
--
-- 2) assign_member_number tenía el search_path mutable (lint 0011). Se le fija.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.assign_member_number() from public, anon, authenticated;

alter function public.assign_member_number() set search_path = public, pg_temp;

-- ─────────────────────────────────────────────────────────────────────────────
-- ⛔ LO QUE **NO** HAY QUE CERRAR, aunque el linter lo marque:
--
--    public.is_super_admin()   → la usan 22 políticas RLS
--    public.current_gym_id()   → la usan 20 políticas RLS
--
-- Postgres SÍ chequea el permiso EXECUTE cuando evalúa una política RLS. Si le
-- revocás EXECUTE al rol `authenticated`, todas esas políticas explotan con
-- "permission denied for function current_gym_id" y CADA dueño y CADA socio se
-- queda sin poder ver sus propios datos. Probado en transacción revertida.
--
-- Y tampoco son una filtración: las dos devuelven información del que llama
-- (si VOS sos super admin, cuál es TU gimnasio). Un desconocido que las llame
-- recibe `false` y `null`. El linter las marca por regla general, no porque
-- estén filtrando algo.
--
-- Si en el futuro aparece de nuevo el aviso 0028/0029 por estas dos: es
-- esperado, se deja así a propósito.
-- ─────────────────────────────────────────────────────────────────────────────
