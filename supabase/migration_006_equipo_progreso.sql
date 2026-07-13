-- ============================================================================
-- GymCore · Migración 006 (parte B — requiere que la 005 ya haya corrido)
-- Empleados (código de alta + visibilidad de finanzas) y seguimiento de
-- progreso del socio (sesiones de rutina con checks de ejercicios).
-- ============================================================================

-- ---------- Gyms: código de alta de empleados + flags de visibilidad --------
alter table public.gyms
  add column if not exists staff_code text unique default substr(md5(gen_random_uuid()::text), 1, 8),
  add column if not exists employees_see_finance boolean not null default false,
  add column if not exists employees_see_income_card boolean not null default false;

update public.gyms set staff_code = substr(md5(gen_random_uuid()::text), 1, 8) where staff_code is null;

-- ---------- handle_new_user: agregar alta de EMPLEADO por staff_code --------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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

  -- DUEÑO (comportamiento original)
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'owner');

  gname := coalesce(nullif(new.raw_user_meta_data->>'gym_name', ''), 'Mi Gimnasio');
  gslug := lower(regexp_replace(gname, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(new.id::text), 1, 4);

  insert into public.gyms (owner_id, name, slug)
  values (new.id, gname, gslug)
  returning id into new_gym_id;

  update public.profiles set gym_id = new_gym_id where id = new.id;

  insert into public.subscriptions (gym_id, plan, status, trial_ends_at)
  values (new_gym_id, 'basico', 'trial', now() + interval '14 days');

  return new;
end; $$;

-- ---------- profiles: el dueño ve y gestiona a su equipo (empleados) -------
drop policy if exists "owner ve su equipo" on public.profiles;
create policy "owner ve su equipo" on public.profiles
  for select using (
    role = 'empleado' and gym_id = public.current_gym_id()
  );

drop policy if exists "owner gestiona su equipo" on public.profiles;
create policy "owner gestiona su equipo" on public.profiles
  for update using (
    role = 'empleado' and gym_id = public.current_gym_id()
  )
  with check (role = 'empleado');

-- ---------- cashflow_entries: ocultar de empleados si el dueño lo decide ---
drop policy if exists "cashflow del gym" on public.cashflow_entries;
create policy "cashflow del gym" on public.cashflow_entries
  for all using (
    public.is_super_admin()
    or (
      gym_id = public.current_gym_id()
      and (
        (select role from public.profiles where id = auth.uid()) <> 'empleado'
        or (select employees_see_finance from public.gyms where id = cashflow_entries.gym_id)
      )
    )
  )
  with check (gym_id = public.current_gym_id() or public.is_super_admin());

-- ---------- Sesiones de rutina: para que el socio marque su progreso -------
create table if not exists public.routine_sessions (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  routine_id   uuid not null references public.routines(id) on delete cascade,
  day_number   int not null default 1,
  date         date not null default current_date,
  started_at   timestamptz default now(),
  completed_at timestamptz
);
create index if not exists routine_sessions_member_idx on public.routine_sessions(member_id, date);

create table if not exists public.routine_session_checks (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references public.routine_sessions(id) on delete cascade,
  routine_exercise_id  uuid not null references public.routine_exercises(id) on delete cascade,
  checked_at           timestamptz default now(),
  unique (session_id, routine_exercise_id)
);
create index if not exists routine_session_checks_session_idx on public.routine_session_checks(session_id);

alter table public.routine_sessions enable row level security;
alter table public.routine_session_checks enable row level security;

drop policy if exists "routine_sessions propio o gym" on public.routine_sessions;
create policy "routine_sessions propio o gym" on public.routine_sessions
  for all using (
    exists (select 1 from public.members m where m.id = routine_sessions.member_id
      and (m.linked_user_id = auth.uid() or m.gym_id = public.current_gym_id() or public.is_super_admin()))
  )
  with check (
    exists (select 1 from public.members m where m.id = routine_sessions.member_id
      and (m.linked_user_id = auth.uid() or m.gym_id = public.current_gym_id() or public.is_super_admin()))
  );

drop policy if exists "routine_session_checks propio o gym" on public.routine_session_checks;
create policy "routine_session_checks propio o gym" on public.routine_session_checks
  for all using (
    exists (
      select 1 from public.routine_sessions s
      join public.members m on m.id = s.member_id
      where s.id = routine_session_checks.session_id
        and (m.linked_user_id = auth.uid() or m.gym_id = public.current_gym_id() or public.is_super_admin())
    )
  )
  with check (
    exists (
      select 1 from public.routine_sessions s
      join public.members m on m.id = s.member_id
      where s.id = routine_session_checks.session_id
        and (m.linked_user_id = auth.uid() or m.gym_id = public.current_gym_id() or public.is_super_admin())
    )
  );
