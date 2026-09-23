-- Corte del servicio por falta de pago, con dias de gracia.
--
-- Hasta hoy NO EXISTIA ningun corte: una suscripcion vencida, o incluso
-- cancelada, conservaba el sistema completo. El unico lugar que miraba el
-- estado era el cron de WhatsApp, para no mandar recordatorios.
--
-- Como queda:
--   dia 0            vence el abono
--   dias 1 y 2       avisa que vencio
--   dia gracia - 2   "el <fecha> se corta el servicio si no recibimos el pago"
--   dia gracia - 1   "manana se corta tu servicio"
--   dia gracia       se corta
--
-- Con los 5 dias por defecto eso cae en los dias 3, 4 y 5, que es lo pedido.

-- Por gimnasio. NULL = usa el valor general de la plataforma.
alter table public.subscriptions add column if not exists dias_gracia int
  check (dias_gracia is null or (dias_gracia >= 0 and dias_gracia <= 3650));

comment on column public.subscriptions.dias_gracia is
  'Dias de tolerancia despues del vencimiento antes de cortar. NULL = el valor general. Un numero grande (ej 3650) es, en la practica, "a este no lo cortes nunca".';

-- Cuando se le corto. Sirve para saber desde cuando esta afuera y para que el
-- pago lo pueda volver a abrir sin dejar rastro raro.
alter table public.subscriptions add column if not exists cortado_at timestamptz;

comment on column public.subscriptions.cortado_at is
  'Cuando se le corto el servicio por falta de pago. Se limpia sola al registrarle el pago.';

-- El valor general, editable desde Cobros sin tocar codigo.
alter table public.platform_settings add column if not exists dias_gracia_default int not null default 5
  check (dias_gracia_default >= 0 and dias_gracia_default <= 3650);

comment on column public.platform_settings.dias_gracia_default is
  'Dias de gracia para todos los que no tengan uno propio. Por defecto 5.';

-- Que exista la fila 1, que es la unica que se usa.
insert into public.platform_settings (id) values (1) on conflict (id) do nothing;
