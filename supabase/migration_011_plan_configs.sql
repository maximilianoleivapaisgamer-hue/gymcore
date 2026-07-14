-- Migración 011: planes de GymCore editables desde el Super Admin.
-- Guarda precio, textos, beneficios y qué funciones desbloquea cada plan.
-- Lectura pública (para mostrar precios); escritura solo super admin.

create table if not exists plan_configs (
  key text primary key,
  sort int not null default 0,
  label text not null,
  tagline text not null default '',
  price numeric not null default 0,
  promo_price numeric,
  promo_note text,
  featured boolean not null default false,
  features jsonb not null default '[]'::jsonb,
  capabilities jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table plan_configs enable row level security;

drop policy if exists "plan_configs lectura publica" on plan_configs;
create policy "plan_configs lectura publica" on plan_configs for select using (true);

drop policy if exists "plan_configs escribe super admin" on plan_configs;
create policy "plan_configs escribe super admin" on plan_configs for all using (is_super_admin()) with check (is_super_admin());

insert into plan_configs (key, sort, label, tagline, price, promo_price, promo_note, featured, features, capabilities) values
('basico',1,'Básico','Para gimnasios que arrancan.',49000,null,null,false,
  '["Una sola sucursal","Socios ilimitados","Gestión de socios y cobros","Rutinas y finanzas","Clases y reservas","Portal del socio","Página pública white-label"]'::jsonb,
  '["clases"]'::jsonb),
('pro',2,'Pro','Para gimnasios en crecimiento.',79000,null,null,true,
  '["Hasta 3 sucursales","Todo lo del Básico","Dietas y planes de comida","Recordatorios automáticos"]'::jsonb,
  '["clases","dietas","control_acceso"]'::jsonb),
('elite',3,'Elite','Para cadenas y multi-sede.',119000,90000,'Primer mes a $90.000 para gimnasios que contraten ahora.',false,
  '["Sucursales ilimitadas","Todo lo del Pro","Control de acceso por QR","Cobros online (Mercado Pago)","Soporte prioritario"]'::jsonb,
  '["clases","dietas","control_acceso","ia"]'::jsonb)
on conflict (key) do nothing;
