-- Migración 022: librería global de ejercicios (con demostración animada).
--
-- Extiende la tabla `exercises` para soportar ejercicios GLOBALES (compartidos
-- por todos los gimnasios), además de los propios de cada gym.
--  * gym_id pasa a ser NULL para los globales.
--  * is_global marca los de la librería.
--  * image_url = foto de INICIO; image_url_end = foto de FIN. Alternándolas se
--    arma la animación tipo GIF (fotos de dominio público: Free Exercise DB).
--  * metadata: músculos, equipo, nivel, instrucciones (en español).
--  * ext_id: id de origen, para que la carga sea idempotente (no duplica).

alter table public.exercises alter column gym_id drop not null;

alter table public.exercises add column if not exists is_global boolean not null default false;
alter table public.exercises add column if not exists image_url_end text;
alter table public.exercises add column if not exists equipment text;
alter table public.exercises add column if not exists level text;
alter table public.exercises add column if not exists category text;
alter table public.exercises add column if not exists primary_muscles text[] default '{}';
alter table public.exercises add column if not exists secondary_muscles text[] default '{}';
alter table public.exercises add column if not exists instructions text[] default '{}';
alter table public.exercises add column if not exists ext_id text;

-- Único por ext_id (los NULL son distintos entre sí, así los ejercicios de cada
-- gym que no tienen ext_id no chocan). Debe ser NO parcial para poder usar
-- upsert ON CONFLICT (ext_id) al cargar la librería.
create unique index if not exists idx_exercises_ext_id on public.exercises (ext_id);
create index if not exists idx_exercises_global on public.exercises (is_global) where is_global = true;

-- Cualquiera (dueños, empleados y socios) puede LEER los ejercicios de la
-- librería global. Los escribe solo el backend (service role) al cargarlos.
drop policy if exists "exercises global read" on public.exercises;
create policy "exercises global read" on public.exercises
  for select using (is_global = true);
