-- Migración 018: suspender demos.
-- Permite pausar una demo: su web pública deja de mostrarse (muestra un aviso
-- de "no disponible") sin borrarla.

alter table gyms add column if not exists demo_suspended boolean not null default false;

comment on column gyms.demo_suspended is
  'true = demo suspendida (la web pública no se muestra).';
