-- Cupos extra por clases sueltas vendidas.
--
-- Al vender una clase suelta el dueño elige qué hacer:
--   · SUMAR CUPO   → el socio la ve en su app y la reserva él mismo. Sirve para
--                    el que compra una clase para más adelante.
--   · NO SUMAR     → solo se registra la plata. Es la clase de hoy, el socio ya
--                    está en la puerta y no va a reservar nada por la web.
--
-- El contador vive en members.clases_extra y se SUMA al tope del plan.
--
-- Se pone en cero al renovarle la cuota: la clase extra que compró es para el
-- período que está cursando, no se acumula para siempre. Si no la usa antes de
-- renovar, la pierde — igual que las clases del plan.

alter table public.members
  add column if not exists clases_extra int not null default 0;

comment on column public.members.clases_extra is
  'Cupos extra por clases sueltas vendidas. Se suman al tope del plan y se resetean al renovar la cuota.';

-- El trigger del tope ahora contempla los cupos extra.
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
  extra         int;
  plan_json     jsonb;
  limite        int;
  modo          text;
  lista         jsonb;
  clase_nombre  text;
  en_lista      boolean;
  usadas        int;
  ciclo_fin     date;
  ciclo_ini     date;
  vueltas       int := 0;
begin
  select p.role into rol from public.profiles p where p.id = auth.uid();
  if rol is distinct from 'member' then
    return new;
  end if;

  select m.plan_name, m.membership_expiry, coalesce(m.clases_extra, 0)
    into plan_nombre, vence, extra
  from public.members m where m.id = new.member_id;

  if plan_nombre is null or trim(plan_nombre) = '' then
    return new;
  end if;

  select p into plan_json
  from public.gyms g,
       lateral jsonb_array_elements(coalesce(g.real_plans, '[]'::jsonb)) p
  where g.id = new.gym_id
    and lower(trim(p->>'name')) = lower(trim(plan_nombre))
  limit 1;

  if plan_json is null then
    return new;
  end if;

  -- ¿La actividad está incluida en el plan?
  -- OJO: los cupos extra suben el TOPE, no habilitan una actividad que el plan
  -- no cubre. Si le vendieron una clase de algo que su plan excluye, la anota
  -- el dueño desde el panel de Clases.
  modo  := coalesce(nullif(plan_json->>'clases_modo', ''), 'todas');
  lista := coalesce(plan_json->'clases_lista', '[]'::jsonb);

  if modo <> 'todas' and jsonb_array_length(lista) > 0 then
    select lower(trim(c.name)) into clase_nombre
    from public.classes c where c.id = new.class_id;

    select exists (
      select 1 from jsonb_array_elements_text(lista) x
      where lower(trim(x)) = clase_nombre
    ) into en_lista;

    if modo = 'solo' and not en_lista then
      raise exception 'Tu plan % no incluye esta actividad. Consultá en el gimnasio para sumarla.',
        trim(plan_nombre) using errcode = 'check_violation';
    end if;
    if modo = 'excepto' and en_lista then
      raise exception 'Tu plan % no incluye esta actividad; se contrata aparte. Consultá en el gimnasio.',
        trim(plan_nombre) using errcode = 'check_violation';
    end if;
  end if;

  limite := nullif(plan_json->>'class_limit', '')::int;
  if limite is null or limite <= 0 then
    return new;  -- plan ilimitado
  end if;

  -- Las clases sueltas que le vendieron se suman a lo que incluye el plan.
  limite := limite + coalesce(extra, 0);

  if vence is null then
    ciclo_ini := date_trunc('month', new.class_date)::date - 1;
    ciclo_fin := (date_trunc('month', new.class_date) + interval '1 month')::date - 1;
  else
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

revoke execute on function public.enforce_class_limit() from public, anon, authenticated;
