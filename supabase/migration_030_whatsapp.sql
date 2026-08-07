-- Recordatorios de cuota por WhatsApp (Cloud API de Meta).
-- El TOKEN central (Tech Provider) va por variable de entorno; por gimnasio se
-- guarda su número (phone_number_id) y si tiene los recordatorios activados.

alter table public.gyms
  add column if not exists wa_phone_id text,                    -- phone_number_id del número del gimnasio
  add column if not exists wa_reminders boolean not null default false, -- on/off de recordatorios automáticos
  add column if not exists wa_days_before int not null default 3;       -- avisar N días antes del vencimiento

-- Para no mandar dos veces el mismo recordatorio: guardamos cuándo y por qué
-- vencimiento se avisó por última vez a cada socio.
alter table public.members
  add column if not exists last_reminder_at timestamptz,
  add column if not exists last_reminder_for date;
