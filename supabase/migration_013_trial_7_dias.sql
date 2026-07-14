-- Migración 013: período de prueba de 7 días (antes 14).
-- Redefine el trigger que crea la suscripción trial al registrarse un gimnasio.

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  gname := coalesce(nullif(new.raw_user_meta_data->>'gym_name', ''), 'Mi Gimnasio');
  gslug := lower(regexp_replace(gname, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(new.id::text), 1, 4);

  insert into public.gyms (owner_id, name, slug)
  values (new.id, gname, gslug)
  returning id into new_gym_id;

  update public.profiles set gym_id = new_gym_id where id = new.id;

  insert into public.subscriptions (gym_id, plan, status, trial_ends_at)
  values (new_gym_id, 'basico', 'trial', now() + interval '7 days');

  return new;
end; $function$;
