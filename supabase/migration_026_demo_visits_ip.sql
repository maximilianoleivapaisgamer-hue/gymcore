-- Migración 026: excluir los eventos propios del super admin por IP (hasheada).
alter table public.demo_visits add column if not exists ip_hash text;
alter table public.demo_visits add column if not exists is_owner boolean not null default false;
create table if not exists public.admin_ips (
  ip_hash  text primary key,
  seen_at  timestamptz default now()
);
alter table public.admin_ips enable row level security;
drop policy if exists "admin_ips super admin" on public.admin_ips;
create policy "admin_ips super admin" on public.admin_ips
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'));
