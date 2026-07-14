-- Migración 017: gimnasios demo.
--
-- Un gimnasio demo es una cuenta preconfigurada que Maxi genera para mostrarle
-- a un prospecto (web branded + panel + app del socio). No es un cliente real:
-- se marca con is_demo=true para poder excluirlo de la facturación y las
-- métricas del Super Admin.

alter table gyms add column if not exists is_demo boolean not null default false;

create index if not exists idx_gyms_is_demo on gyms(is_demo) where is_demo = true;

comment on column gyms.is_demo is
  'true = gimnasio demo (prospecto). Excluir de métricas/facturación reales.';
