-- ============================================================================
-- GymCore · Migración 003
-- Agrega: altura del socio, historial de peso (para que el socio vea su
-- evolución desde el portal), y evita reservas duplicadas de una misma clase.
-- Cómo usar: Supabase → SQL Editor → pegar todo esto → Run.
-- ============================================================================

-- Altura actual del socio (el peso se guarda en su propio historial).
alter table public.members
  add column if not exists height_cm numeric(5,1);

-- Historial de peso: una fila por carga (semanal/mensual). El socio ve acá
-- si viene bajando o subiendo de peso desde que empezó.
create table if not exists public.weight_logs (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  date        date not null default current_date,
  weight_kg   numeric(5,1) not null,
  created_at  timestamptz default now()
);
create index if not exists weight_logs_member_idx on public.weight_logs(member_id, date);

alter table public.weight_logs enable row level security;

-- Puede ver/cargar su propio historial: el socio dueño de la ficha (por
-- linked_user_id), el dueño del gimnasio, o el super-admin.
drop policy if exists "weight_logs propio o gym" on public.weight_logs;
create policy "weight_logs propio o gym" on public.weight_logs
  for all using (
    exists (
      select 1 from public.members m
      where m.id = weight_logs.member_id
        and (m.linked_user_id = auth.uid() or m.gym_id = public.current_gym_id() or public.is_super_admin())
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = weight_logs.member_id
        and (m.linked_user_id = auth.uid() or m.gym_id = public.current_gym_id() or public.is_super_admin())
    )
  );

-- Evita que el mismo socio quede anotado dos veces en la misma clase/fecha
-- (podía pasar si tocaba "Reservar" dos veces desde el portal).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_unicas') then
    alter table public.bookings
      add constraint bookings_unicas unique (class_id, member_id, class_date);
  end if;
end $$;
