-- Cerrar las funciones de trigger que agregamos en las migraciones 049 y 051.
--
-- El linter de Supabase las marco como llamables desde /rest/v1/rpc por anon y
-- authenticated, aunque en las dos migraciones ya habia un
-- `revoke all ... from public`.
--
-- POR QUE NO ALCANZABA: Supabase tiene default privileges que le dan EXECUTE a
-- `anon` y `authenticated` sobre TODA funcion nueva de `public`. Sacarselo a
-- PUBLIC no toca esos permisos explicitos. Hay que revocar de los tres.
--
-- (Ojo: el gotcha del CLAUDE.md decia lo inverso — que revocar de anon y
--  authenticated no alcanzaba porque heredan de PUBLIC. Las dos cosas son
--  ciertas: hay que revocar de los tres, siempre.)
--
-- NO ROMPE LOS TRIGGERS: Postgres ejecuta una funcion de trigger como dueño de
-- la tabla, no como quien dispara la operacion, y no le chequea EXECUTE al que
-- llama. La prueba estaba al lado: `enforce_class_limit` (migration_038) nunca
-- tuvo esos permisos y frena reservas en produccion desde hace semanas.
-- Verificado ademas suplantando a una socia real: al intentar cancelar una
-- clase ya empezada siguio saltando "Ya pasó el plazo para cancelar".
--
-- ⚠️ Esto NO se le hace a `is_super_admin()` ni a `current_gym_id()`: esas las
-- evalua RLS con el permiso del que llama, y revocarlas deja a todos los dueños
-- y socios sin acceso a sus datos. Ver migration_037.

revoke execute on function public.enforce_cancel_window()  from public, anon, authenticated;
revoke execute on function public.enforce_booking_expiry() from public, anon, authenticated;

grant execute on function public.enforce_cancel_window()  to service_role;
grant execute on function public.enforce_booking_expiry() to service_role;
