-- Revierte migration_045: saca la lectura pública de `classes`.
--
-- QUÉ PASÓ. La 045 abrió `classes` a todo el mundo para que la grilla se viera
-- en la web pública de cada gimnasio. Pero el portal del socio hacía
-- `from("classes").select("*")` SIN filtrar por gym_id: se apoyaba en RLS para
-- aislarse. Al abrir la tabla, los socios empezaron a ver las clases de todos
-- los demás gimnasios y demos.
--
-- CÓMO SE ARREGLÓ, en dos capas:
--   1. Las consultas filtran por gym_id A MANO (portal y panel). El aislamiento
--      no puede depender de una sola capa.
--   2. La web pública lee las clases desde el SERVIDOR con el service role
--      (app/(public)/[slug]/page.tsx), acotado a ese gimnasio y a 4 columnas.
--      Así la grilla se sigue viendo sin abrirle la tabla a nadie.

drop policy if exists "clases lectura pública" on public.classes;
