-- Simulacion de resultados: "asi podes llegar a estar en 3 y 6 meses".
--
-- El dueño le saca una foto al socio cuando se anota y la app le muestra una
-- imagen orientativa de como puede verse siguiendo su plan. Le queda guardada
-- en SU perfil, para que la vea cada vez que entra.
--
-- ⚠️ ESTO PROMETE ALGO SOBRE EL CUERPO DE UNA PERSONA. Hay tres recaudos que
-- NO se sacan sin hablarlo, porque son los que lo vuelven defendible:
--
--  1. CONSENTIMIENTO. Se guarda el texto exacto que la persona acepto y cuando.
--     Sin consentimiento no se genera. Es una foto del cuerpo de alguien que
--     ademas sale a un servicio de terceros (Ley 25.326).
--
--  2. LA LEYENDA VA QUEMADA EN LA IMAGEN, no al lado. La gracia de esto es que
--     se comparta por WhatsApp, y ahi la imagen viaja sola: si el "resultado
--     orientativo" estuviera solo en la pantalla, se pierde en el primer reenvio
--     y queda una promesa pelada circulando.
--
--  3. EL NUMERO SALE DE SUS DATOS, no del modelo. Se calcula un peso objetivo
--     realista con su peso, su altura y su ritmo real, y la imagen se pide
--     contra ESE numero. Si se deja al modelo elegir, devuelve un cuerpo de
--     revista que nadie va a alcanzar. Ver lib/proyeccion.ts.

create table if not exists public.member_simulaciones (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id)    on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,

  -- La foto que saco el dueño. Se guarda para poder mostrar el "antes" al lado.
  foto_url    text not null,
  -- 3 o 6. Se guarda como numero para poder sumar mas plazos despues.
  meses       int  not null check (meses > 0 and meses <= 24),
  -- La imagen generada, ya con la leyenda quemada.
  imagen_url  text,

  -- De donde sale y a donde llega, para poder explicar el numero si lo piden.
  peso_desde  numeric(5,1),
  peso_hasta  numeric(5,1),
  -- "bajar", "recomposicion" o "subir": cambia lo que se le pide al modelo.
  enfoque     text,

  -- El consentimiento, textual. Se guarda el texto que se le mostro, porque el
  -- texto puede cambiar y lo que vale es lo que ESTA persona acepto ese dia.
  consentimiento_at    timestamptz not null default now(),
  consentimiento_texto text not null,

  creado_por  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- Si el modelo falla, queda el motivo para poder mirarlo.
  error       text
);

create index if not exists simulaciones_socio_idx
  on public.member_simulaciones (member_id, created_at desc);
create index if not exists simulaciones_gym_mes_idx
  on public.member_simulaciones (gym_id, created_at desc);

comment on table public.member_simulaciones is
  'Imagenes orientativas de resultado. Cada fila guarda el consentimiento que la persona acepto y el peso objetivo con el que se genero.';

alter table public.member_simulaciones enable row level security;

-- El gimnasio ve las suyas; el socio ve LAS PROPIAS, que es el punto de que le
-- queden guardadas en su app.
drop policy if exists "simulaciones del gym" on public.member_simulaciones;
create policy "simulaciones del gym" on public.member_simulaciones
  for all using ((gym_id = public.current_gym_id()) or public.is_super_admin());

drop policy if exists "el socio ve las suyas" on public.member_simulaciones;
create policy "el socio ve las suyas" on public.member_simulaciones
  for select using (
    member_id in (select id from public.members where linked_user_id = auth.uid())
  );

-- Tope mensual por gimnasio. Cada imagen cuesta plata, asi que un tope evita
-- que un solo cliente se lleve puesto el presupuesto jugando.
alter table public.platform_settings
  add column if not exists simulaciones_por_mes int not null default 30
  check (simulaciones_por_mes >= 0 and simulaciones_por_mes <= 10000);

comment on column public.platform_settings.simulaciones_por_mes is
  'Cuantas simulaciones puede generar cada gimnasio por mes. Cada una cuesta plata.';

-- Queda en Pro y Elite.
update public.plan_configs
   set capabilities = (
         select jsonb_agg(distinct x)
         from jsonb_array_elements_text(capabilities || '["simulaciones"]'::jsonb) x
       ),
       features = case
         when features::text like '%imulaci%' then features
         else features || '["Simulador de resultados con IA"]'::jsonb
       end,
       updated_at = now()
 where key in ('pro', 'elite');
