-- ============================================================================
-- GymCore · Migración 007
-- Número de socio secuencial por gimnasio (evita confusión con duplicados).
-- Nota: la feature de "Bloques" dentro de cada día de rutina (routine_exercises)
-- no necesitó cambios de esquema — ya existía la columna block_name; el cambio
-- fue sólo de UI (editor del dashboard y vista del portal).
-- ============================================================================

alter table public.members add column if not exists member_number int;

-- Backfill: numerar los socios existentes por gym_id, en orden de alta.
with numbered as (
  select id, row_number() over (partition by gym_id order by created_at, id) as rn
  from public.members
)
update public.members m
set member_number = numbered.rn
from numbered
where m.id = numbered.id
  and m.member_number is null;

-- A partir de ahora, autoasignar el próximo número disponible por gym_id.
create or replace function public.assign_member_number()
returns trigger language plpgsql as $$
begin
  if new.member_number is null then
    select coalesce(max(member_number), 0) + 1 into new.member_number
    from public.members where gym_id = new.gym_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_member_number on public.members;
create trigger trg_assign_member_number
  before insert on public.members
  for each row execute function public.assign_member_number();

create unique index if not exists members_gym_number_uidx on public.members(gym_id, member_number);
