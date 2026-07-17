-- Migración 024: visitas/actividad de las demos (para saber si el prospecto entró).
create table if not exists public.demo_visits (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists idx_demo_visits_gym on public.demo_visits (gym_id, created_at desc);
alter table public.demo_visits enable row level security;
drop policy if exists "demo_visits super admin read" on public.demo_visits;
create policy "demo_visits super admin read" on public.demo_visits
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'));
