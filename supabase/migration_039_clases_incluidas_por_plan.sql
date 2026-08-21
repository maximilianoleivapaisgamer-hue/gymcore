-- Qué ACTIVIDADES incluye cada plan (además de cuántas clases).
--
-- Caso real que lo motivó (DanzArte): el "Pase Libre" cubre todas las
-- actividades SALVO Kangoo Jumps (se hace con botas especiales que pone el
-- estudio, por eso va aparte), y hay un plan "Kango Jumps" que es solo eso.
--
-- Cada plan de gyms.real_plans suma dos campos:
--   clases_modo  : 'todas' (por defecto) | 'excepto' | 'solo'
--   clases_lista : nombres de actividades, tal cual los cargó el dueño
--
--   Pase Libre  -> modo 'excepto', lista ["Kangoo Jumps"]
--   Kango Jumps -> modo 'solo',    lista ["Kangoo Jumps"]
--   PACK 1 / 2  -> modo 'todas' + class_limit 8 / 12
--
-- POR QUÉ POR NOMBRE Y NO POR ID DE CLASE: el dueño carga una fila por horario
-- (DanzArte tiene 4 filas de "Zumba" y 1 de "Kangoo Jumps"). Guardando el
-- NOMBRE, la regla vale para todos los horarios de esa actividad, incluidos los
-- que agregue después. Si guardáramos ids, cada horario nuevo se escaparía de
-- la regla sin que nadie se entere.
--   Contra: si renombra una actividad, el plan deja de matchear. Por eso la
--   pantalla de Planes avisa cuando un plan apunta a una actividad que ya no
--   existe, en vez de fallar en silencio.
--
-- Todo se compara con trim+lower: los nombres cargados a mano vienen con
-- espacios y mayúsculas irregulares ("Kangoo Jumps ", "Zumba ").

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
  -- 1) Solo se le aplica al SOCIO. El dueño, los profes y el servidor
  --    (service role, donde auth.uid() es null) pueden pasarse.
  select p.role into rol from public.profiles p where p.id = auth.uid();
  if rol is distinct from 'member' then
    return new;
  end if;

  -- 2) Plan del socio.
  select m.plan_name, m.membership_expiry
    into plan_nombre, vence
  from public.members m where m.id = new.member_id;

  if plan_nombre is null or trim(plan_nombre) = '' then
    return new;  -- sin plan asignado no hay regla que aplicar
  end if;

  select p into plan_json
  from public.gyms g,
       lateral jsonb_array_elements(coalesce(g.real_plans, '[]'::jsonb)) p
  where g.id = new.gym_id
    and lower(trim(p->>'name')) = lower(trim(plan_nombre))
  limit 1;

  if plan_json is null then
    return new;  -- el plan del socio ya no existe en el gimnasio
  end if;

  -- 3) ¿La actividad está incluida en el plan?
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

  -- 4) ¿Le queda cupo? (vacío o 0 = ilimitado)
  limite := nullif(plan_json->>'class_limit', '')::int;
  if limite is null or limite <= 0 then
    return new;
  end if;

  -- 5) Ciclo de cuota que contiene a la clase (ver migration_038).
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
