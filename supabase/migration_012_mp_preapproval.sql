-- Migración 012: soporte de Mercado Pago (suscripción del abono del gimnasio).
-- Guarda el id de la "preapproval" (suscripción con débito automático) para
-- poder vincular los pagos que llegan por webhook con el gimnasio correcto.

alter table subscriptions
  add column if not exists mp_preapproval_id text;

create index if not exists idx_subscriptions_mp_preapproval on subscriptions (mp_preapproval_id);
