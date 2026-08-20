-- Secciones que el dueño le oculta a sus SOCIOS en la app (portal), aparte de
-- lo que use él en su panel. Guardamos las CLAVES ocultas ("rutina","dieta",
-- "clases"); vacío = el socio ve todas.
alter table public.gyms
  add column if not exists hidden_member_sections text[] not null default '{}';
