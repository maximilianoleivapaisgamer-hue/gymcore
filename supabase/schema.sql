-- ============================================================================
-- GymCore · Esquema de base de datos (Supabase / PostgreSQL)
-- Multi-tenant con Row-Level Security: cada gimnasio ve SOLO sus datos.
-- Esto resuelve el problema de "datos públicos" que tenía la app en Bubble.
--
-- Cómo usar: Supabase → SQL Editor → pegar todo esto → Run.
-- ============================================================================

-- ---------- Tipos / enums --------------------------------------------------
create type user_role as enum ('super_admin', 'owner', 'member');
create type sub_plan  as enum ('basico', 'pro', 'elite');
create type sub_status as enum ('trial', 'active', 'past_due', 'canceled');

-- ---------- Perfiles (extiende auth.users) ---------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        user_role not null default 'owner',
  gym_id      uuid,                 -- gimnasio al que pertenece (owner o member)
  created_at  timestamptz default now()
);

-- ---------- Gimnasios (tenant) + config de la landing ----------------------
create table public.gyms (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  slug          text unique not null,          -- gymcore.app/<slug>
  logo_url      text,
  hero_url      text,
  accent_color  text default '#22d3ee',
  tagline       text,
  description   text,
  benefits      text[] default '{}',
  member_plans  jsonb default '[]',            -- [{name, price, detail}] planes de socio
  whatsapp      text,
  address       text,
  created_at    timestamptz default now()
);

-- FK diferida de profiles.gym_id -> gyms.id
alter table public.profiles
  add constraint profiles_gym_fk foreign key (gym_id) references public.gyms(id) on delete set null;

-- ---------- Suscripción del dueño al SaaS (lo que VOS cobrás) ---------------
create table public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  gym_id             uuid not null references public.gyms(id) on delete cascade,
  plan               sub_plan not null default 'basico',
  status             sub_status not null default 'trial',
  trial_ends_at      timestamptz,
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_sub_id      text,
  created_at         timestamptz default now()
);

-- ---------- Socios del gimnasio (clientes del dueño) -----------------------
create table public.members (
  id                uuid primary key default gen_random_uuid(),
  gym_id            uuid not null references public.gyms(id) on delete cascade,
  linked_user_id    uuid references public.profiles(id) on delete set null,
  full_name         text not null,
  dni               text,
  email             text,
  whatsapp          text,
  photo_url         text,
  plan_name         text,
  plan_price        numeric(12,2),
  membership_expiry date,
  created_at        timestamptz default now()
);

-- ---------- Biblioteca de ejercicios y grupos musculares -------------------
create table public.muscle_groups (
  id      uuid primary key default gen_random_uuid(),
  gym_id  uuid not null references public.gyms(id) on delete cascade,
  name    text not null
);

create table public.exercises (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  muscle_group  uuid references public.muscle_groups(id) on delete set null,
  name          text not null,
  image_url     text,
  video_url     text,
  notes         text
);

-- ---------- Rutinas (modelo normalizado: rutina -> día -> bloque -> ejercicio)
create table public.routines (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  member_id   uuid references public.members(id) on delete cascade,
  name        text,
  is_template boolean default false,   -- true = plantilla reutilizable
  created_at  timestamptz default now()
);

create table public.routine_exercises (
  id            uuid primary key default gen_random_uuid(),
  routine_id    uuid not null references public.routines(id) on delete cascade,
  exercise_id   uuid references public.exercises(id) on delete set null,
  day_number    int not null default 1,
  block_name    text,
  position      int default 0,
  sets          text,
  reps          text,
  notes         text
);

-- ---------- Clases + reservas ----------------------------------------------
create table public.classes (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  name        text not null,
  type        text,
  instructor  text,
  weekdays    text[] default '{}',        -- ['lun','mie','vie']
  start_time  time,
  duration    int,                         -- minutos
  capacity    int,
  color       text,
  created_at  timestamptz default now()
);

create table public.bookings (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  class_id    uuid not null references public.classes(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  class_date  date,
  created_at  timestamptz default now()
);

-- ---------- Asistencia / control de acceso ---------------------------------
create table public.attendances (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  member_id   uuid references public.members(id) on delete set null,
  entered_at  timestamptz default now(),
  status      text                         -- 'ok' | 'expired'
);

-- ---------- Finanzas -------------------------------------------------------
create table public.cashflow_entries (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  concept     text,
  type        text,                        -- 'income' | 'expense'
  amount      numeric(12,2) not null,
  date        date default current_date,
  created_at  timestamptz default now()
);

-- Índices útiles
create index on public.members(gym_id);
create index on public.routines(member_id);
create index on public.attendances(gym_id, entered_at);
create index on public.cashflow_entries(gym_id, date);

-- ============================================================================
-- ROW-LEVEL SECURITY  ·  el corazón del multi-tenant
-- ============================================================================

-- Helper: gym del usuario actual
create or replace function public.current_gym_id()
returns uuid language sql stable security definer set search_path = public as $$
  select gym_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'super_admin');
$$;

-- Activar RLS en todas las tablas
alter table public.profiles          enable row level security;
alter table public.gyms              enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.members           enable row level security;
alter table public.muscle_groups     enable row level security;
alter table public.exercises         enable row level security;
alter table public.routines          enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.classes           enable row level security;
alter table public.bookings          enable row level security;
alter table public.attendances       enable row level security;
alter table public.cashflow_entries  enable row level security;

-- profiles: cada quien ve/edita su perfil; super_admin ve todo
create policy "perfil propio" on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());
create policy "editar perfil propio" on public.profiles
  for update using (id = auth.uid());

-- gyms:
--   * lectura PÚBLICA (para la landing white-label por slug)
--   * el dueño edita SOLO su gimnasio
create policy "gym lectura pública" on public.gyms
  for select using (true);
create policy "gym dueño edita" on public.gyms
  for all using (owner_id = auth.uid() or public.is_super_admin())
  with check (owner_id = auth.uid() or public.is_super_admin());

-- Macro de política estándar: acceso solo a filas del propio gimnasio.
-- (Se repite por tabla porque Postgres no permite políticas genéricas.)
create policy "members del gym" on public.members
  for all using (gym_id = public.current_gym_id() or public.is_super_admin())
  with check (gym_id = public.current_gym_id() or public.is_super_admin());

create policy "muscle_groups del gym" on public.muscle_groups
  for all using (gym_id = public.current_gym_id() or public.is_super_admin())
  with check (gym_id = public.current_gym_id() or public.is_super_admin());

create policy "exercises del gym" on public.exercises
  for all using (gym_id = public.current_gym_id() or public.is_super_admin())
  with check (gym_id = public.current_gym_id() or public.is_super_admin());

create policy "routines del gym" on public.routines
  for all using (gym_id = public.current_gym_id() or public.is_super_admin())
  with check (gym_id = public.current_gym_id() or public.is_super_admin());

create policy "routine_exercises del gym" on public.routine_exercises
  for all using (exists(select 1 from public.routines r where r.id = routine_id and (r.gym_id = public.current_gym_id() or public.is_super_admin())))
  with check (exists(select 1 from public.routines r where r.id = routine_id and (r.gym_id = public.current_gym_id() or public.is_super_admin())));

create policy "classes del gym" on public.classes
  for all using (gym_id = public.current_gym_id() or public.is_super_admin())
  with check (gym_id = public.current_gym_id() or public.is_super_admin());

create policy "bookings del gym" on public.bookings
  for all using (gym_id = public.current_gym_id() or public.is_super_admin())
  with check (gym_id = public.current_gym_id() or public.is_super_admin());

create policy "attendances del gym" on public.attendances
  for all using (gym_id = public.current_gym_id() or public.is_super_admin())
  with check (gym_id = public.current_gym_id() or public.is_super_admin());

create policy "cashflow del gym" on public.cashflow_entries
  for all using (gym_id = public.current_gym_id() or public.is_super_admin())
  with check (gym_id = public.current_gym_id() or public.is_super_admin());

create policy "subs del gym" on public.subscriptions
  for select using (gym_id = public.current_gym_id() or public.is_super_admin());

-- ---------- Trigger: crear profile al registrarse --------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Storage: bucket público para logos y fotos ---------------------
insert into storage.buckets (id, name, public)
values ('gym-assets', 'gym-assets', true)
on conflict (id) do nothing;

create policy "assets lectura pública" on storage.objects
  for select using (bucket_id = 'gym-assets');
create policy "assets subida autenticada" on storage.objects
  for insert to authenticated with check (bucket_id = 'gym-assets');
