-- Secciones del panel que el dueño puede apagar (las que no usa).
-- Guardamos las CLAVES de las secciones ocultas; vacío = se ven todas.
-- Las secciones núcleo (Inicio, Socios, Mi plan, Mi cuenta) no se pueden apagar.
alter table public.gyms
  add column if not exists hidden_sections text[] not null default '{}';
