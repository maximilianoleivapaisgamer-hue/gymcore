-- Migración 021: archivar gimnasios desde el Super Admin.
--
-- 'archived' permite sacar un gimnasio de la lista de clientes y de las métricas
-- sin borrarlo, para poder reactivarlo más adelante ("volver a levantarlo").

alter table public.gyms
  add column if not exists archived boolean not null default false;

comment on column public.gyms.archived is
  'true = gimnasio archivado (oculto de la lista de clientes y de las métricas del admin).';

create index if not exists idx_gyms_archived on public.gyms (archived);
