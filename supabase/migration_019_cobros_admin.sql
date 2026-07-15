-- Migración 019: método de pago del abono + ajustes de la plataforma.
--
--  * subscriptions.payment_method: cómo paga el gimnasio su abono
--    ('transferencia' | 'mercadopago'). El webhook de MP la marca en
--    'mercadopago'; los cobros cargados a mano por el super admin quedan en
--    'transferencia'. Sirve para separar en el dashboard cuánto entra por cada vía.
--
--  * platform_settings: una sola fila (id=1) con los ajustes globales del SaaS
--    (datos para que los gimnasios te transfieran, y si al convertir una demo se
--    limpian los datos de ejemplo).

alter table public.subscriptions
  add column if not exists payment_method text;

comment on column public.subscriptions.payment_method is
  'Cómo paga el gimnasio su abono: transferencia | mercadopago (null = sin registrar).';

create table if not exists public.platform_settings (
  id                    smallint primary key default 1,
  transfer_alias        text,
  transfer_cbu          text,
  transfer_holder       text,
  transfer_note         text,
  convert_clear_sample  boolean not null default true,
  updated_at            timestamptz default now(),
  constraint platform_settings_single_row check (id = 1)
);

insert into public.platform_settings (id) values (1)
  on conflict (id) do nothing;

-- Solo el super admin lee/escribe estos ajustes.
alter table public.platform_settings enable row level security;

drop policy if exists "platform settings super admin" on public.platform_settings;
create policy "platform settings super admin" on public.platform_settings
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'));
