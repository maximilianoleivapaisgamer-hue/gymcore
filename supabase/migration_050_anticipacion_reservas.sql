-- Con cuánta anticipación pueden reservar los socios.
--
-- Estaba fijo en 3 semanas (una constante en el portal). DanzArte pidió poder
-- abrir el mes entero: "si los socios pueden reservar las clases del mes, que
-- solo les salta por semana".
--
-- Se cuenta en semanas e INCLUYE la semana en curso:
--   1 = solo esta semana (como funcionaba antes de las flechas)
--   3 = esta y las dos siguientes  <- el valor de hasta ahora, es el default
--   4 = un mes
--
-- El default de 3 deja a todos los gimnasios exactamente como venían.

alter table public.gyms
  add column if not exists reserva_semanas integer not null default 3;

comment on column public.gyms.reserva_semanas is
  'Cuántas semanas puede reservar el socio para adelante, contando la actual. 1 = solo esta semana.';
