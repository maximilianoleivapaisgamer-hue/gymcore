-- Tope de clases por plan.
--
-- Cada plan del gimnasio (gyms.real_plans) puede tener un "class_limit": cuántas
-- clases por ciclo incluye. Vacío, null o 0 = ILIMITADO (ej: "Pase Libre").
-- El campo lo carga el dueño desde /dashboard/planes.
--
-- POR QUÉ UN TRIGGER Y NO UN CHEQUEO EN LA PANTALLA:
-- el socio reserva directo desde el navegador contra Supabase (app/portal),
-- no hay una API del servidor en el medio. Un control solo en el front se
-- esquiva. Acá el tope se aplica venga de donde venga la reserva.
--
-- QUÉ ES "EL CICLO": los 30 días de la cuota de CADA socio, anclados a
-- members.membership_expiry. Si vence el 20/09, su ciclo va del 20/08 al 20/09.
-- Si el socio no tiene vencimiento cargado, se cae al mes calendario.
--
-- QUIÉN QUEDA AFUERA: solo se frena al SOCIO reservando desde su app. El dueño
-- y los profes pueden pasarse del tope desde el panel de Clases (para regalar
-- una clase, cobrar una suelta o reponer una que el socio perdió).

create or replace function public.enforce_class_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rol           text;
  plan_nombre   text;
  vence         date;
  limite        int;
  usadas        int;
  ciclo_fin     date;
  ciclo_ini     date;
  vueltas       int := 0;
begin
  -- 1) Solo se le aplica al socio. Dueño, staff y servidor (service role,
  --    donde auth.uid() es null) pueden pasarse.
  select p.role into rol from public.profiles p where p.id = auth.uid();
  if rol is distinct from 'member' then
    return new;
  end if;

  -- 2) Plan del socio y su vencimiento.
  select m.plan_name, m.membership_expiry
    into plan_nombre, vence
  from public.members m where m.id = new.member_id;

  if plan_nombre is null or trim(plan_nombre) = '' then
    return new;  -- sin plan asignado no hay tope que aplicar
  end if;

  -- 3) Tope del plan. Se compara con trim/lower porque los nombres cargados a
  --    mano suelen traer espacios de más ("PACK 1 ").
  select nullif((p->>'class_limit'), '')::int
    into limite
  from public.gyms g,
       lateral jsonb_array_elements(coalesce(g.real_plans, '[]'::jsonb)) p
  where g.id = new.gym_id
    and lower(trim(p->>'name')) = lower(trim(plan_nombre))
  limit 1;

  if limite is null or limite <= 0 then
    return new;  -- plan ilimitado
  end if;

  -- 4) En qué ciclo cae la clase que quiere reservar.
  if vence is null then
    -- Sin vencimiento cargado: mes calendario.
    ciclo_ini := date_trunc('month', new.class_date)::date - 1;
    ciclo_fin := (date_trunc('month', new.class_date) + interval '1 month')::date - 1;
  else
    -- Ciclos de un mes anclados al vencimiento. Se busca el ciclo que contiene
    -- a class_date moviéndose de a un mes. El tope de vueltas es una red de
    -- seguridad por si llega una fecha absurda.
    ciclo_fin := vence;
    while ciclo_fin < new.class_date and vueltas < 600 loop
      ciclo_fin := (ciclo_fin + interval '1 month')::date;
      vueltas := vueltas + 1;
    end loop;
    while (ciclo_fin - interval '1 month')::date >= new.class_date and vueltas < 600 loop
      ciclo_fin := (ciclo_fin - interval '1 month')::date;
      vueltas := vueltas + 1;
    end loop;
    ciclo_ini := (ciclo_fin - interval '1 month')::date;
  end if;

  -- 5) Contar lo ya reservado en ese ciclo (sin contar esta reserva).
  select count(*) into usadas
  from public.bookings b
  where b.member_id = new.member_id
    and b.class_date > ciclo_ini
    and b.class_date <= ciclo_fin;

  if usadas >= limite then
    raise exception 'Tu plan % incluye % clases y ya reservaste las %. Cancelá una para poder reservar otra, o consultá en el gimnasio.',
      trim(plan_nombre), limite, usadas
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Es trigger: nadie necesita poder invocarla por RPC.
revoke execute on function public.enforce_class_limit() from public, anon, authenticated;

drop trigger if exists trg_enforce_class_limit on public.bookings;
create trigger trg_enforce_class_limit
  before insert on public.bookings
  for each row execute function public.enforce_class_limit();
