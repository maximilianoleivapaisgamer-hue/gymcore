-- ============================================================================
-- GymCore · Migración 009
-- Tema de la app por gimnasio (white-label): color de marca + estilo de fondo.
--  · theme     → clave de la paleta (celeste, azul, verde, ambar, violeta,
--                rosa, grafito). Tiñe botones, acentos y el fondo, así todo
--                combina entre sí.
--  · bg_style  → estilo del fondo: aurora (animado) / suave / solido.
-- Se elige desde /dashboard/configuracion y aplica al dashboard, al portal del
-- socio y al login propio del gimnasio.
-- ============================================================================

alter table public.gyms
  add column if not exists theme text not null default 'celeste';

alter table public.gyms
  add column if not exists bg_style text not null default 'aurora';
