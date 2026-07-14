-- Migración 014: permisos de empleados.
-- Cada empleado (profile con role='empleado') guarda en 'permissions' las
-- secciones del panel que el dueño le habilitó (socios, rutinas, dietas,
-- clases, finanzas, control_acceso).

alter table profiles
  add column if not exists permissions text[] not null default '{}';
