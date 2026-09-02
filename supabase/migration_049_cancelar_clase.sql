-- Hasta cuándo puede el socio cancelar una clase.
--
-- Lo pidió DanzArte: "si quiere cancelar tiene hasta 2 hs antes; y si estaba
-- anotada y no fue, perdió una clase". La idea es que las socias se anoten en
-- serio y no dejen el cupo bloqueado hasta último momento.
--
-- Cómo funciona:
--   - `cancelacion_activa`: si el negocio usa límite o no. Arranca APAGADO, así
--     no le cambia las reglas a ningún gimnasio que ya venía andando.
--   - `cancelacion_horas`: cuántas horas antes del inicio se puede cancelar.
--     0 = hasta que empieza la clase.
--
-- "Perder la clase" no necesita nada extra: si no puede cancelar, la reserva
-- queda, y el tope del plan cuenta las reservas del ciclo (haya ido o no).
--
-- POR QUÉ UN TRIGGER Y NO SOLO LA PANTALLA: igual que el tope de clases
-- (migration_038), el socio borra la reserva directo desde el navegador contra
-- Supabase. Un control solo en el front se esquiva.

alter table public.gyms
  add column if not exists cancelacion_activa boolean not null default false,
  add column if not exists cancelacion_horas  integer not null default 2;

comment on column public.gyms.cancelacion_activa is
  'Si el socio tiene un límite de tiempo para cancelar una clase desde su app.';
comment on column public.gyms.cancelacion_horas is
  'Cuántas horas antes del inicio se puede cancelar. 0 = hasta que empieza.';


create or replace function public.enforce_cancel_window()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rol      text;
  activa   boolean;
  horas    integer;
  hora_ini time;
  limite   timestamptz;
begin
  -- 1) Solo se le aplica al SOCIO cancelando desde su app. El dueño y los
  --    profes sacan una reserva cuando quieran desde el panel de Clases, y el
  --    servidor (service role, donde auth.uid() es null) también.
  select p.role into rol from public.profiles p where p.id = auth.uid();
  if rol is distinct from 'member' then
    return old;
  end if;

  -- 2) ¿Este negocio usa límite?
  select g.cancelacion_activa, g.cancelacion_horas
    into activa, horas
  from public.gyms g
  where g.id = old.gym_id;

  if not coalesce(activa, false) then
    return old;
  end if;

  -- 3) Cuándo arranca la clase. Sin horario cargado, cuenta desde las 00:00.
  select c.start_time into hora_ini
  from public.classes c
  where c.id = old.class_id;

  limite := ((old.class_date + coalesce(hora_ini, '00:00'::time))
              at time zone 'America/Argentina/Buenos_Aires')
            - make_interval(hours => coalesce(horas, 2));

  if now() > limite then
    if coalesce(horas, 2) = 0 then
      raise exception 'Esta clase ya empezó, no se puede cancelar.'
        using errcode = 'check_violation';
    else
      raise exception 'Ya pasó el plazo para cancelar: se puede hasta % horas antes de que empiece la clase.', coalesce(horas, 2)
        using errcode = 'check_violation';
    end if;
  end if;

  return old;
end;
$$;

revoke all on function public.enforce_cancel_window() from public;

drop trigger if exists trg_enforce_cancel_window on public.bookings;
create trigger trg_enforce_cancel_window
  before delete on public.bookings
  for each row execute function public.enforce_cancel_window();
