-- ============================================================================
-- GymCore - Migracion 008
-- Sistema de plantillas para la landing publica: el dueno puede elegir entre
-- dos disenos ("Clasica" / "Moderna") y definir el orden/visibilidad de las
-- secciones opcionales (beneficios, galeria, planes, contacto) desde
-- /dashboard/configuracion. El hero y el CTA final siempre se muestran.
-- ============================================================================

alter table public.gyms
  add column if not exists landing_template text not null default 'clasica';

alter table public.gyms
  add constraint gyms_landing_template_check
  check (landing_template in ('clasica', 'moderna'));

alter table public.gyms
  add column if not exists landing_sections jsonb not null default '[
    {"key": "beneficios", "visible": true},
    {"key": "galeria", "visible": true},
    {"key": "planes", "visible": true},
    {"key": "contacto", "visible": true}
  ]'::jsonb;
