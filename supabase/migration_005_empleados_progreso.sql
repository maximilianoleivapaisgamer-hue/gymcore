-- ============================================================================
-- GymCore · Migración 005 (parte A)
-- Nuevo rol EMPLEADO. Debe ejecutarse en su propia transacción: Postgres no
-- permite usar un valor de enum recién agregado dentro de la misma
-- transacción en la que se lo agrega (por eso va en un archivo aparte de la
-- parte B, que sí usa 'empleado' en el trigger handle_new_user).
-- ============================================================================

alter type public.user_role add value if not exists 'empleado';
