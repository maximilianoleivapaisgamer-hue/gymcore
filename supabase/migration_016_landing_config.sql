-- Migración 016: config de la landing pública (plantilla definitiva).
--
-- La landing white-label de cada gimnasio (turnogym.app/<slug>) se arma con una
-- plantilla única. Su contenido se guarda en esta columna como las EDICIONES del
-- dueño; los valores por defecto (textos de ejemplo, secciones demo) viven en el
-- código (lib/landing-config.ts) y se combinan al renderizar.
--
-- Empieza en null a propósito: un gimnasio que todavía no editó nada ve la
-- plantilla con el contenido de ejemplo ya cargado, mezclado con su nombre,
-- color de marca, WhatsApp, dirección e Instagram reales.

alter table gyms add column if not exists landing_config jsonb;

comment on column gyms.landing_config is
  'Ediciones de la landing pública (plantilla definitiva). Se combina con los defaults de lib/landing-config.ts. Null = sin ediciones (usa demo + identidad del gym).';
