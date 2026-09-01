-- Foto de la clase.
--
-- La carga el dueño desde el panel de Clases y la ve el socio en la grilla del
-- portal, al lado del nombre. Es opcional: si está vacía se muestra el color
-- de la clase, como hasta ahora.
--
-- La imagen vive en el bucket público `gym-assets` (el mismo del logo y la
-- galería de la web), así que acá solo guardamos la URL.

alter table public.classes add column if not exists image_url text;

comment on column public.classes.image_url is
  'Foto de la clase para el portal del socio. URL pública de gym-assets. Opcional.';
