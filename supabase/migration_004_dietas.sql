-- ============================================================================
-- GymCore · Migración 004
-- Módulo de Dietas (solo disponible para gimnasios en el plan Elite).
-- Espeja la arquitectura de Rutinas: plantillas reutilizables que el dueño
-- arma una vez y aplica como copia independiente a cada socio.
-- Cómo usar: Supabase → SQL Editor → pegar todo esto → Run.
-- ============================================================================

create table if not exists public.diets (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  name        text,
  member_id   uuid references public.members(id) on delete cascade,
  is_template boolean not null default true,
  created_at  timestamptz default now()
);
create index if not exists diets_gym_idx on public.diets(gym_id);
create index if not exists diets_member_idx on public.diets(member_id);

-- Comidas de la dieta: una fila por comida/día (Desayuno, Colación, Almuerzo,
-- Merienda, Cena...). day_number agrupa por día, igual que routine_exercises.
create table if not exists public.diet_meals (
  id          uuid primary key default gen_random_uuid(),
  diet_id     uuid not null references public.diets(id) on delete cascade,
  day_number  int not null default 1,
  meal_type   text not null,
  position    int not null default 0,
  title       text,
  detail      text,
  photo_url   text
);
create index if not exists diet_meals_diet_idx on public.diet_meals(diet_id);

-- Progreso: el socio marca qué comidas fue cumpliendo, para ver su
-- adherencia semanal en "Tu progreso".
create table if not exists public.diet_progress (
  id          uuid primary key default gen_random_uuid(),
  diet_id     uuid not null references public.diets(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  meal_id     uuid not null references public.diet_meals(id) on delete cascade,
  date        date not null default current_date,
  created_at  timestamptz default now(),
  unique (member_id, meal_id, date)
);
create index if not exists diet_progress_member_idx on public.diet_progress(member_id, date);

alter table public.diets enable row level security;
alter table public.diet_meals enable row level security;
alter table public.diet_progress enable row level security;

drop policy if exists "diets propio o gym" on public.diets;
create policy "diets propio o gym" on public.diets
  for all using (
    gym_id = public.current_gym_id() or public.is_super_admin()
    or exists (select 1 from public.members m where m.id = diets.member_id and m.linked_user_id = auth.uid())
  )
  with check (gym_id = public.current_gym_id() or public.is_super_admin());

drop policy if exists "diet_meals propio o gym" on public.diet_meals;
create policy "diet_meals propio o gym" on public.diet_meals
  for all using (
    exists (
      select 1 from public.diets d where d.id = diet_meals.diet_id
      and (d.gym_id = public.current_gym_id() or public.is_super_admin()
        or exists (select 1 from public.members m where m.id = d.member_id and m.linked_user_id = auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.diets d where d.id = diet_meals.diet_id
      and (d.gym_id = public.current_gym_id() or public.is_super_admin())
    )
  );

drop policy if exists "diet_progress propio o gym" on public.diet_progress;
create policy "diet_progress propio o gym" on public.diet_progress
  for all using (
    exists (select 1 from public.members m where m.id = diet_progress.member_id
      and (m.linked_user_id = auth.uid() or m.gym_id = public.current_gym_id() or public.is_super_admin()))
  )
  with check (
    exists (select 1 from public.members m where m.id = diet_progress.member_id
      and (m.linked_user_id = auth.uid() or m.gym_id = public.current_gym_id() or public.is_super_admin()))
  );
