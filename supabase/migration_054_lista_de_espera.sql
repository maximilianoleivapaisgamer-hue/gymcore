-- Lista de espera de clases.
--
-- El socio que quiere una clase llena se anota en la lista. Cuando alguien
-- cancela, al PRIMERO de la fila le llega un aviso al celular y el lugar queda
-- GUARDADO PARA EL durante un rato; si no lo toma, queda libre para todos.
--
-- Se eligio "te guardo el lugar un rato" y no "te anoto directo" a proposito:
-- con la regla de cancelacion prendida (DanzArte tiene 2 horas), anotar a
-- alguien sin que se entere puede hacerle PERDER una clase del pack si no llega
-- a cancelar. El lugar guardado no le cuesta nada si no lo toma.

create table if not exists public.class_waitlist (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id)    on delete cascade,
  sede_id    uuid references public.sedes(id)            on delete set null,
  class_id   uuid not null references public.classes(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  class_date date not null,
  -- El orden de la fila sale de aca: el que se anoto primero, va primero.
  created_at timestamptz not null default now(),
  -- Cuando se le ofrecio el lugar y hasta cuando es suyo. Null = todavia
  -- espera su turno.
  ofrecido_at timestamptz,
  vence_at    timestamptz,
  -- Una sola vez por socio y por clase-fecha.
  unique (class_id, class_date, member_id)
);

create index if not exists class_waitlist_clase_idx
  on public.class_waitlist (class_id, class_date, created_at);
create index if not exists class_waitlist_member_idx
  on public.class_waitlist (member_id);

comment on table public.class_waitlist is
  'Socios esperando un lugar en una clase llena. El primero de la fila tiene el lugar guardado mientras vence_at este en el futuro.';

-- Igual que push_subscriptions: RLS prendido y sin politicas. Se toca solo
-- desde /api/clases/espera con service role, que saca el socio de la sesion.
alter table public.class_waitlist enable row level security;


-- ── El cupo, ahora SI, controlado en la base ────────────────────────────
--
-- Hasta hoy `classes.capacity` se respetaba solo en la pantalla: el socio
-- reserva directo contra Supabase desde el navegador, asi que una clase llena
-- se podia reservar igual salteando la interfaz.
--
-- Ademas de cerrar ese agujero, este trigger es lo que hace que la lista de
-- espera signifique algo: mientras el primero de la fila tiene el lugar
-- guardado, ese lugar cuenta como ocupado para todos los demas.
create or replace function public.enforce_class_capacity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rol       text;
  cupo      int;
  ocupados  int;
  guardados int;
begin
  -- Solo al socio desde su app. El dueño y los profes anotan igual: a veces
  -- hay que meter a alguien de mas y ellos saben lo que hacen.
  select p.role into rol from public.profiles p where p.id = auth.uid();
  if rol is distinct from 'member' then
    return new;
  end if;

  select c.capacity into cupo from public.classes c where c.id = new.class_id;
  if cupo is null or cupo <= 0 then
    return new;  -- sin cupo cargado, no hay tope que aplicar
  end if;

  select count(*) into ocupados
  from public.bookings b
  where b.class_id = new.class_id and b.class_date = new.class_date;

  -- Lugares guardados para OTRO socio que esta primero en la fila. El turno
  -- vencido no cuenta: se libera solo, sin que nadie tenga que limpiarlo.
  select count(*) into guardados
  from public.class_waitlist w
  where w.class_id = new.class_id
    and w.class_date = new.class_date
    and w.member_id <> new.member_id
    and w.vence_at is not null
    and w.vence_at > now();

  if ocupados + guardados >= cupo then
    if guardados > 0 then
      raise exception 'Ese lugar esta guardado para alguien de la lista de espera. Si no lo toma, se libera en un rato.'
        using errcode = 'check_violation';
    end if;
    raise exception 'Esta clase ya esta completa.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Ver el gotcha del CLAUDE.md: hay que revocar de los TRES, porque Supabase le
-- da EXECUTE explicito a anon y authenticated sobre toda funcion nueva.
revoke execute on function public.enforce_class_capacity() from public, anon, authenticated;
grant  execute on function public.enforce_class_capacity() to service_role;

drop trigger if exists trg_enforce_class_capacity on public.bookings;
create trigger trg_enforce_class_capacity
  before insert on public.bookings
  for each row execute function public.enforce_class_capacity();


-- Al reservar, el socio sale de la lista de espera de esa clase: ya consiguio
-- el lugar. Va en un trigger aparte, DESPUES de insertar, para que valga tanto
-- si reservo el socio como si lo anoto el dueño.
create or replace function public.limpiar_lista_de_espera()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.class_waitlist
  where class_id = new.class_id
    and class_date = new.class_date
    and member_id = new.member_id;
  return new;
end;
$$;

revoke execute on function public.limpiar_lista_de_espera() from public, anon, authenticated;
grant  execute on function public.limpiar_lista_de_espera() to service_role;

drop trigger if exists trg_limpiar_lista_de_espera on public.bookings;
create trigger trg_limpiar_lista_de_espera
  after insert on public.bookings
  for each row execute function public.limpiar_lista_de_espera();
