-- Migración 025: tipo de evento de la demo (web / panel / socio).
alter table public.demo_visits add column if not exists kind text not null default 'web';
create index if not exists idx_demo_visits_gym_kind on public.demo_visits (gym_id, kind, created_at desc);
