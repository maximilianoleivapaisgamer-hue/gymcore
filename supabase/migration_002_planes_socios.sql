-- ============================================================================
-- GymCore · Migración 002
-- Agrega: planes reales del gimnasio (separados de la landing), observación
-- y recordatorios por socio, y vínculo de cobros con el socio y el plan.
-- Cómo usar: Supabase → SQL Editor → pegar todo esto → Run.
-- ============================================================================

-- Planes reales del gimnasio (lo que efectivamente se cobra). Cada uno puede
-- tildarse para sincronizarse con la lista pública de la landing.
alter table public.gyms
  add column if not exists real_plans jsonb default '[]';

-- Socios: nota libre (ej. "con descuento por 3 meses") y preferencias de
-- recordatorio automático de vencimiento.
alter table public.members
  add column if not exists observacion text,
  add column if not exists reminder_whatsapp boolean default true,
  add column if not exists reminder_email boolean default false;

-- Caja: vincular cada cobro a un socio y guardar qué plan se cobró, para
-- poder armar el historial de pagos en la vista de detalle del socio.
alter table public.cashflow_entries
  add column if not exists member_id uuid references public.members(id) on delete set null,
  add column if not exists plan_name text;

create index if not exists cashflow_entries_member_id_idx on public.cashflow_entries(member_id);

-- Una sola suscripción por gimnasio, para poder editarla desde /admin con upsert.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_gym_id_key') then
    alter table public.subscriptions add constraint subscriptions_gym_id_key unique (gym_id);
  end if;
end $$;

-- Permitir que el super_admin inserte/actualice suscripciones desde /admin
-- (antes la policy de subscriptions solo permitía "select").
drop policy if exists "subs del gym" on public.subscriptions;
create policy "subs select" on public.subscriptions
  for select using (gym_id = public.current_gym_id() or public.is_super_admin());
create policy "subs admin escribe" on public.subscriptions
  for insert with check (public.is_super_admin());
create policy "subs admin actualiza" on public.subscriptions
  for update using (public.is_super_admin()) with check (public.is_super_admin());
