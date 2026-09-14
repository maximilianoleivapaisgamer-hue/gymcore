-- El registro desde la web ahora guarda con quien estamos hablando.
--
-- Hasta hoy el formulario pedia cuatro cosas: nombre, gimnasio, email y
-- contraseña. El 2026-09-14 se registro "Eteban" y NO HAY FORMA DE ESCRIBIRLE:
-- ni telefono, ni direccion, ni idea de que tipo de negocio tiene.
--
-- Los tres datos nuevos sirven para las dos puntas a la vez: nosotros podemos
-- contactarlo, y son datos que el gimnasio igual iba a tener que cargar para
-- que su pagina y sus recordatorios funcionen.

-- El rubro. Cambia que le mostramos y como le hablamos: no es lo mismo un
-- estudio de pilates de 20 alumnas que un gimnasio de musculacion de 400.
alter table public.gyms add column if not exists rubro text;

comment on column public.gyms.rubro is
  'Que tipo de negocio es: gimnasio, pilates, danza, funcional, artes-marciales, personal, otro. Lo elige el dueño al registrarse.';


-- ── El trigger de alta ──────────────────────────────────────────────────
--
-- Dos cambios sobre el que ya estaba:
--
--  1. Guarda whatsapp, direccion y rubro si vienen en el alta.
--
--  2. `skip_gym`: no crea gimnasio cuando quien llama lo va a crear el mismo.
--     Esto arregla un bug real: el generador de demos crea el usuario dueño SIN
--     nombre de gimnasio, asi que este trigger le armaba un "Mi Gimnasio" vacio
--     con su propia suscripcion de prueba, y recien despues el generador creaba
--     el demo de verdad. Quince demos generados, quince gimnasios fantasma
--     ensuciando la lista de clientes y las metricas.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acct        text := coalesce(new.raw_user_meta_data->>'account_type', 'owner');
  new_gym_id  uuid;
  gname       text;
  gslug       text;
  target_gym  uuid;
  scode       text;
begin
  if acct = 'member' then
    insert into public.profiles (id, full_name, role)
    values (new.id, new.raw_user_meta_data->>'full_name', 'member');

    gslug := new.raw_user_meta_data->>'gym_slug';
    if gslug is not null and gslug <> '' then
      select id into target_gym from public.gyms where slug = gslug;
    end if;

    update public.members
       set linked_user_id = new.id
     where lower(email) = lower(new.email)
       and (target_gym is null or gym_id = target_gym)
       and linked_user_id is null;

    return new;
  end if;

  if acct = 'empleado' then
    scode := new.raw_user_meta_data->>'staff_code';
    if scode is not null and scode <> '' then
      select id into target_gym from public.gyms where staff_code = scode;
    end if;

    insert into public.profiles (id, full_name, role, gym_id)
    values (new.id, new.raw_user_meta_data->>'full_name', 'empleado', target_gym);

    return new;
  end if;

  -- DUEÑO
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'owner');

  -- Quien crea el gimnasio por su cuenta (el generador de demos) pide que no se
  -- lo armemos nosotros. Sin esto quedaba un gimnasio fantasma por cada demo.
  if coalesce(new.raw_user_meta_data->>'skip_gym', '') = 'true' then
    return new;
  end if;

  gname := coalesce(nullif(new.raw_user_meta_data->>'gym_name', ''), 'Mi Gimnasio');
  gslug := lower(regexp_replace(gname, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(new.id::text), 1, 4);

  insert into public.gyms (owner_id, name, slug, whatsapp, address, rubro)
  values (
    new.id, gname, gslug,
    nullif(new.raw_user_meta_data->>'whatsapp', ''),
    nullif(new.raw_user_meta_data->>'address', ''),
    nullif(new.raw_user_meta_data->>'rubro', '')
  )
  returning id into new_gym_id;

  update public.profiles set gym_id = new_gym_id where id = new.id;

  insert into public.subscriptions (gym_id, plan, status, trial_ends_at)
  values (new_gym_id, 'basico', 'trial', now() + interval '7 days');

  return new;
end;
$$;
