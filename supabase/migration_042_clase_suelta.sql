-- Venta de clases sueltas.
--
-- Pasa seguido: alguien que no es socio quiere probar una clase, o un socio
-- que ya usó las clases de su plan quiere una más. Hasta ahora eso se cargaba
-- como un ingreso suelto en Finanzas, escribiendo el concepto y el monto a
-- mano cada vez.
--
-- Ahora el negocio deja configurado si las vende y a cuánto, y al venderla la
-- pantalla trae ese precio ya puesto — pero se puede cambiar, porque no todas
-- valen lo mismo (la que trae un amigo, la del socio que se pasó del plan,
-- la de una actividad más cara).
--
-- OJO: vender una clase suelta NO le toca el vencimiento al socio. Es una
-- clase extra, no una cuota.

alter table public.gyms
  add column if not exists clase_suelta_activa boolean not null default false,
  add column if not exists clase_suelta_precio numeric(12,2);

comment on column public.gyms.clase_suelta_activa is
  'Si el negocio vende clases sueltas. Prende el botón "Vender clase suelta" en la ficha del socio.';
comment on column public.gyms.clase_suelta_precio is
  'Precio sugerido de la clase suelta. Se puede pisar en cada venta.';
