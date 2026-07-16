-- Migración 023: origen de cada ejercicio.
--
-- source distingue de dónde salió el ejercicio:
--   'biblioteca' → librería global (con demostración animada + instrucciones)
--   'ia'         → lo creó la IA al generar una rutina
--   'manual'     → lo cargó el gimnasio a mano
--
-- Sirve para separarlos en el buscador y en la biblioteca del gimnasio.

alter table public.exercises
  add column if not exists source text not null default 'manual';

update public.exercises set source = 'biblioteca' where is_global = true;

create index if not exists idx_exercises_source on public.exercises (source);
