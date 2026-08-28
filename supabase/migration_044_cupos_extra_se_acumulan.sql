-- Los cupos extra por clases sueltas ahora se ACUMULAN.
--
-- En migration_043 se borraban al renovar la cuota, con la idea de que la clase
-- comprada era para el período que estaba cursando. El dueño prefiere que el
-- socio no pierda lo que pagó: si compró una clase suelta y no llegó a usarla,
-- la conserva hasta que la use.
--
-- El cambio real está en el código (el cobro de cuota ya no pone clases_extra
-- en cero). Acá solo se corrige el comentario de la columna, que decía lo
-- contrario y confundía a quien leyera el esquema.

comment on column public.members.clases_extra is
  'Cupos extra por clases sueltas vendidas. Se suman al tope del plan y se ACUMULAN hasta que el socio los use (no se resetean al renovar).';
