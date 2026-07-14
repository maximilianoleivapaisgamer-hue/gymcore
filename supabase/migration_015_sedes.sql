-- Migración 015: multi-sede (sucursales).
--
-- Un gimnasio (gym) puede tener varias sedes/sucursales. La lista de socios,
-- rutinas y dietas es COMPARTIDA por todo el gimnasio (si sos socio del gym,
-- podés ir a cualquier sucursal). Lo que se DIVIDE por sede es la operación
-- del día a día: caja (ingresos/egresos), clases y control de acceso.
--
-- No se tocan las políticas RLS existentes: el aislamiento sigue siendo por
-- gym_id (current_gym_id()). La sede es una sub-división dentro del gym que se
-- filtra del lado del cliente con la columna sede_id.
--
-- Límite de sedes según el plan se controla en la app (lib/sede.ts):
--   Básico = 1 · Pro = 3 · Elite = ilimitadas.

-- 1) Tabla de sedes ---------------------------------------------------------
create table if not exists sedes (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references gyms(id) on delete cascade,
  name       text not null,
  address    text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sedes_gym on sedes(gym_id);

alter table sedes enable row level security;

-- Cualquier miembro del gym puede leer sus sedes; el super admin ve todas.
drop policy if exists "sedes lectura del gym" on sedes;
create policy "sedes lectura del gym" on sedes
  for select
  using (gym_id = current_gym_id() or is_super_admin());

-- Solo el dueño (owner/super_admin) del gym administra las sedes.
drop policy if exists "sedes gestiona owner" on sedes;
create policy "sedes gestiona owner" on sedes
  for all
  using (
    gym_id = current_gym_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('owner', 'super_admin')
    )
  )
  with check (gym_id = current_gym_id());

-- 2) Sede principal por cada gym que todavía no tenga sedes -----------------
insert into sedes (gym_id, name)
select g.id, 'Sede principal'
from gyms g
where not exists (select 1 from sedes s where s.gym_id = g.id);

-- 3) Columna sede_id en las tablas que se dividen por sucursal --------------
alter table cashflow_entries add column if not exists sede_id uuid references sedes(id);
alter table classes         add column if not exists sede_id uuid references sedes(id);
alter table bookings        add column if not exists sede_id uuid references sedes(id);
alter table attendances     add column if not exists sede_id uuid references sedes(id);

-- 4) Backfill: mandar todo lo existente a la sede principal de cada gym -----
update cashflow_entries e
set sede_id = s.id
from sedes s
where s.gym_id = e.gym_id and s.name = 'Sede principal' and e.sede_id is null;

update classes c
set sede_id = s.id
from sedes s
where s.gym_id = c.gym_id and s.name = 'Sede principal' and c.sede_id is null;

update bookings b
set sede_id = s.id
from sedes s
where s.gym_id = b.gym_id and s.name = 'Sede principal' and b.sede_id is null;

update attendances a
set sede_id = s.id
from sedes s
where s.gym_id = a.gym_id and s.name = 'Sede principal' and a.sede_id is null;

-- 5) Índices para filtrar rápido por sede ----------------------------------
create index if not exists idx_cashflow_sede on cashflow_entries(sede_id);
create index if not exists idx_classes_sede  on classes(sede_id);
create index if not exists idx_bookings_sede on bookings(sede_id);
create index if not exists idx_attendances_sede on attendances(sede_id);
