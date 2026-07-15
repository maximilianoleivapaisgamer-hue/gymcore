-- Migración 020: pagos por transferencia del abono del gimnasio.
--
-- El dueño elige un plan, ve el alias/CBU, transfiere y sube el comprobante.
-- Queda un registro 'pendiente' que el super admin verifica (hasta 48hs) y
-- aprueba/rechaza desde el panel. Al aprobar se activa la suscripción.
--
-- También agrega platform_settings.support_whatsapp: el WhatsApp de turnogym
-- que se le muestra al dueño para adelantar el control del pago.

alter table public.platform_settings
  add column if not exists support_whatsapp text;

create table if not exists public.transfer_payments (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  plan         text not null,
  amount       numeric,
  receipt_url  text,
  note         text,
  status       text not null default 'pendiente',  -- pendiente | aprobado | rechazado
  created_at   timestamptz default now(),
  reviewed_at  timestamptz
);

create index if not exists idx_transfer_payments_gym on public.transfer_payments (gym_id);
create index if not exists idx_transfer_payments_status on public.transfer_payments (status);

alter table public.transfer_payments enable row level security;

-- El dueño ve las transferencias de SU gimnasio; el super admin, todas.
drop policy if exists "tp select" on public.transfer_payments;
create policy "tp select" on public.transfer_payments
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.gym_id = transfer_payments.gym_id or p.role = 'super_admin')
    )
  );

-- Las escrituras (alta del comprobante y la revisión) van por el backend con
-- service role, que saltea RLS. No habilitamos insert/update directo al cliente.
