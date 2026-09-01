-- Las reservas hechas desde la app del socio quedaban sin sucursal.
--
-- El portal insertaba en `bookings` sin `sede_id`. El panel del dueño filtra
-- las reservas por sede, así que no las contaba: DanzArte tenía 13 socias
-- anotadas y todas las tarjetas de Clases mostraban "0 / 20".
--
-- Es el mismo agujero que hizo desaparecer $140.000 de Finanzas: TODA fila que
-- el panel filtre por sucursal necesita `sede_id` al insertarse.
--
-- El código ya lo carga (la sede sale de la clase). Esto acomoda las que
-- quedaron sin sede.

update public.bookings b
set sede_id = c.sede_id
from public.classes c
where c.id = b.class_id
  and b.sede_id is null
  and c.sede_id is not null;

-- Por si alguna clase tampoco tenía sede: si el gimnasio tiene una sola, es esa.
update public.bookings b
set sede_id = s.id
from public.sedes s
where b.sede_id is null
  and s.gym_id = b.gym_id
  and (select count(*) from public.sedes s2 where s2.gym_id = b.gym_id) = 1;
