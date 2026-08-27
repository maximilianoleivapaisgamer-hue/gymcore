-- Cómo cobra cada negocio: aniversario o día fijo del mes, y el recargo por
-- pagar tarde.
--
-- Hasta ahora había un solo modelo, el de gimnasio ("aniversario"): el socio
-- paga el 20 y le vence el 20 del mes siguiente, cada uno con su fecha. Pero
-- los estudios de danza y pilates suelen cobrar distinto: TODOS los socios
-- vencen el mismo día (ej. "las cuotas se pagan del 1 al 10"), y al que paga
-- después de esa fecha le corre un recargo.
--
--   cobro_modo = 'aniversario' → +1 mes desde su propio vencimiento (default,
--                                es lo que venía haciendo, no cambia nada)
--   cobro_modo = 'dia_fijo'    → siempre el día `cobro_dia` del mes
--
-- El recargo es una SUGERENCIA: cuando el socio paga atrasado, la pantalla de
-- cobro propone el monto con el recargo sumado, pero el dueño lo puede pisar.
-- No se cobra solo: la última palabra siempre la tiene el dueño.

alter table public.gyms
  add column if not exists cobro_modo text not null default 'aniversario',
  add column if not exists cobro_dia int not null default 10,
  add column if not exists recargo_tipo text,
  add column if not exists recargo_valor numeric(12,2);

-- Solo los dos modos que entiende la app.
alter table public.gyms drop constraint if exists gyms_cobro_modo_check;
alter table public.gyms add constraint gyms_cobro_modo_check
  check (cobro_modo in ('aniversario', 'dia_fijo'));

-- Día del mes válido.
alter table public.gyms drop constraint if exists gyms_cobro_dia_check;
alter table public.gyms add constraint gyms_cobro_dia_check
  check (cobro_dia between 1 and 28);

-- null = sin recargo. 'monto' = pesos fijos. 'porcentaje' = % sobre la cuota.
alter table public.gyms drop constraint if exists gyms_recargo_tipo_check;
alter table public.gyms add constraint gyms_recargo_tipo_check
  check (recargo_tipo is null or recargo_tipo in ('monto', 'porcentaje'));

comment on column public.gyms.cobro_modo is
  'aniversario = +1 mes desde el vencimiento de cada socio; dia_fijo = todos vencen el dia cobro_dia.';
comment on column public.gyms.recargo_tipo is
  'Recargo por pago atrasado: null (ninguno), monto (pesos) o porcentaje. Se SUGIERE al cobrar, no se aplica solo.';
