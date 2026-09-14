-- Comisiones de profesores.
--
-- Lo pidio DanzArte: "se puede ver a fin de mes cuanto cada profe?".
--
-- LA REGLA, como la definieron ellos por WhatsApp:
--
--   "50% queda DanzArte, el resto se divide por profesor segun cantidad de
--    clases, para que sea equitativo. Y el porcentaje si, por ahora 50%; para
--    los profesores nuevos es 40%."
--
-- O sea, socio por socio:
--   1. Se toma lo que ESE socio pago en el mes.
--   2. Se reparte entre las profes segun cuantas clases hizo con cada una.
--      (8 clases con Karina y 4 con Priscila => 2/3 y 1/3, no mitad y mitad.)
--   3. Cada profe cobra SU porcentaje de la parte que le toco.
--
-- Por eso el porcentaje va POR PROFESORA y no es un numero suelto del gimnasio:
-- las nuevas cobran menos.

create table if not exists public.profesores (
  id         uuid primary key default gen_random_uuid(),
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  nombre     text not null,
  -- Cuanto se lleva ella de la parte que le corresponde. 50 es lo normal en
  -- DanzArte; 40 las que recien entran.
  porcentaje numeric(5,2) not null default 50 check (porcentaje >= 0 and porcentaje <= 100),
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

-- El nombre es la llave contra `classes.instructor`, que es texto libre. Se
-- compara sin distinguir mayusculas ni espacios de sobra, asi "Karina " y
-- "karina" no se convierten en dos profesoras distintas.
create unique index if not exists profesores_nombre_idx
  on public.profesores (gym_id, lower(btrim(nombre)));

comment on table public.profesores is
  'El porcentaje de comision de cada profe. Se cruza con classes.instructor por nombre; la que no esta cargada aca cobra el 50% por defecto.';

alter table public.profesores enable row level security;

-- Mismo criterio que el resto de las tablas del negocio.
drop policy if exists "profesores del gym" on public.profesores;
create policy "profesores del gym" on public.profesores
  for all using ((gym_id = public.current_gym_id()) or public.is_super_admin());


-- ── La funcion queda disponible en Pro y Elite ──────────────────────────
--
-- Es una funcion de negocio que resuelve un dolor concreto, de las que
-- justifican pagar mas. DanzArte hoy esta en Basico, asi que es la primera
-- oportunidad real de subirlos de plan con algo que pidieron ellos mismos.
update public.plan_configs
   set capabilities = (
         select jsonb_agg(distinct x)
         from jsonb_array_elements_text(capabilities || '["comisiones"]'::jsonb) x
       ),
       features = case
         when features::text like '%omisiones%' then features
         else features || '["Comisiones de profes calculadas solas"]'::jsonb
       end,
       updated_at = now()
 where key in ('pro', 'elite');
