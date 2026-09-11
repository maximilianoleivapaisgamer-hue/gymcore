-- Avisos al celular (notificaciones push).
--
-- Es el freno mas grande de los cuatro que pedian las tiendas: sin esto la app
-- no hace nada que la web no haga, y se rechaza por "funcionalidad minima".
-- Pero ademas sirve solo, sin tienda: "tu clase empieza en 2 horas" y "se te
-- vence la cuota el viernes" hoy no existen en ningun lado.
--
-- Cada suscripcion es UN NAVEGADOR de un socio, no un socio: la misma persona
-- puede tener el celular y la compu, y hay que avisarle en los dos.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id)    on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  -- La cuenta de acceso: sirve para encontrar sus suscripciones desde la sesion.
  user_id     uuid not null,
  -- La direccion que da el navegador. Es unica por dispositivo: si el socio
  -- vuelve a activar los avisos en el mismo telefono, se pisa la de antes.
  endpoint    text not null unique,
  -- Las dos claves con las que se cifra el mensaje (RFC 8291).
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  -- Ultima vez que el servicio de push acepto un envio.
  last_ok_at  timestamptz,
  -- Envios fallidos seguidos. Si el navegador se dio de baja, la limpiamos.
  fallos      integer not null default 0
);

create index if not exists push_subscriptions_member_idx on public.push_subscriptions (member_id);
create index if not exists push_subscriptions_gym_idx    on public.push_subscriptions (gym_id);

comment on table public.push_subscriptions is
  'Un navegador suscripto a los avisos. La baja la hace el propio socio o el servidor cuando el envio falla.';


-- Nadie toca esta tabla desde el navegador: se maneja SIEMPRE por
-- /api/push/*, que valida la sesion y usa el service role. Con RLS prendido y
-- sin politicas, anon y authenticated no ven ni escriben nada.
alter table public.push_subscriptions enable row level security;


-- Para no avisar dos veces de la misma clase. Va en la reserva y no en una
-- tabla aparte: si el socio cancela, la reserva se borra y la marca con ella.
alter table public.bookings
  add column if not exists aviso_clase_at timestamptz;

comment on column public.bookings.aviso_clase_at is
  'Cuando se le mando el aviso de "tu clase empieza pronto". Null = todavia no.';

-- El cron busca reservas de hoy sin avisar: este indice es el que hace que no
-- recorra la tabla entera en cada corrida.
create index if not exists bookings_aviso_pendiente_idx
  on public.bookings (class_date)
  where aviso_clase_at is null;
