-- Lectura pública de la grilla de clases.
--
-- La web de cada gimnasio la mira gente ANÓNIMA (un prospecto que entra a ver
-- los horarios). `gyms` ya tenía una política de lectura pública para eso, pero
-- `classes` no: solo la veían el dueño y sus socios. Resultado: con
-- `clases_sync` prendido la grilla llegaba vacía a la web.
--
-- Qué se expone: nombre de la clase, días, horario, duración, cupo y profe.
-- Es exactamente lo que un gimnasio publica en su web y pega en la puerta.
-- No hay datos de socios ni nada personal: las reservas viven en `bookings`,
-- que sigue cerrada.
--
-- Es SOLO SELECT. Crear, editar y borrar clases lo siguen manejando las
-- políticas de siempre ("classes del gym").

drop policy if exists "clases lectura pública" on public.classes;
create policy "clases lectura pública" on public.classes
  for select using (true);
