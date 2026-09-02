-- No dejar reservar clases posteriores al vencimiento de la cuota.
--
-- Salió de abrir el mes entero (`migration_050`): con el calendario largo, una
-- socia se anota a clases de dentro de tres semanas sin haber pagado ese mes.
-- El tope del pack no alcanza para frenarlo, porque cuenta contra el ciclo al
-- que corresponde cada fecha.
--
-- Arranca APAGADO. Prenderlo cambia lo que puede hacer un socio, así que cada
-- negocio lo decide en Configuración → Reservas de clases.
--
-- OJO CON LA CONSECUENCIA: la regla es "no se reserva más allá del vencimiento".
-- Para un socio que ya está vencido, TODAS las fechas son posteriores, así que
-- no puede reservar nada hasta que pague. En un gimnasio donde se paga unos
-- días tarde y se cobra recargo, eso lo deja afuera esos días. Si hace falta,
-- lo que se agrega es un margen de días, no se saca la regla.

alter table public.gyms
  add column if not exists reserva_hasta_vencimiento boolean not null default false;

comment on column public.gyms.reserva_hasta_vencimiento is
  'Si el socio solo puede reservar clases hasta la fecha en que le vence la cuota.';


create or replace function public.enforce_booking_expiry()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rol    text;
  activa boolean;
  vence  date;
begin
  -- Solo al socio desde su app. El dueño y los profes anotan a quien quieran
  -- desde el panel de Clases, igual que con el tope y con el plazo de cancelar.
  select p.role into rol from public.profiles p where p.id = auth.uid();
  if rol is distinct from 'member' then
    return new;
  end if;

  select g.reserva_hasta_vencimiento into activa
  from public.gyms g where g.id = new.gym_id;

  if not coalesce(activa, false) then
    return new;
  end if;

  select m.membership_expiry into vence
  from public.members m where m.id = new.member_id;

  -- Sin vencimiento cargado no hay nada contra qué comparar: no se frena.
  if vence is null then
    return new;
  end if;

  if new.class_date > vence then
    raise exception 'Tu cuota está paga hasta el %. Para anotarte a partir de ahí, renovala.', to_char(vence, 'DD/MM')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_booking_expiry() from public;

drop trigger if exists trg_enforce_booking_expiry on public.bookings;
create trigger trg_enforce_booking_expiry
  before insert on public.bookings
  for each row execute function public.enforce_booking_expiry();
