-- Migración 010: secciones nuevas de la landing pública.
-- Agrega testimonios de socios, grilla de horarios/clases y horarios de
-- atención (para la sección de ubicación con mapa).

alter table gyms
  add column if not exists testimonials jsonb not null default '[]'::jsonb,
  add column if not exists class_schedule jsonb not null default '[]'::jsonb,
  add column if not exists open_hours text;
