-- Marca los recordatorios por WhatsApp como función del plan Pro (y superior).
-- Agrega la capacidad "whatsapp" a Pro y Elite (sin duplicar si ya estaba) y
-- actualiza el texto de la lista de funciones del Pro.
update public.plan_configs
  set capabilities = capabilities || '["whatsapp"]'::jsonb
  where key in ('pro', 'elite')
    and not (capabilities @> '["whatsapp"]'::jsonb);

-- Reemplaza el viejo "Recordatorios automáticos" por el texto nuevo en el Pro.
update public.plan_configs
  set features = replace(features::text, 'Recordatorios automáticos', 'Recordatorios de cuota por WhatsApp')::jsonb
  where key = 'pro' and features::text like '%Recordatorios automáticos%';

-- Si el Pro no menciona los recordatorios, se lo agregamos a la lista.
update public.plan_configs
  set features = features || '["Recordatorios de cuota por WhatsApp"]'::jsonb
  where key = 'pro'
    and features::text not ilike '%whatsapp%'
    and features::text not ilike '%recordatorio%';
