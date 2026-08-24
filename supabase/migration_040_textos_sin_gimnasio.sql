-- Saca la palabra "gimnasio" de los textos que ve el cliente que está por
-- contratar. TurnoGym no lo usan solo gimnasios: hay estudios de pilates,
-- escuelas de danza, centros de yoga y entrenadores personales. Leer "Para
-- gimnasios que arrancan" cuando tenés un estudio de pilates te deja afuera.
--
-- Estos taglines salen de plan_configs, así que se ven en el checkout de
-- activación (/activar/[slug]) y en "Mi plan" del dueño.
--
-- Ojo: hay que tocarlo acá Y en DEFAULT_PLANS de lib/plans.ts, porque los
-- gimnasios reales leen la base y no los defaults.

update public.plan_configs set tagline = 'Para los que están arrancando.'  where key = 'basico';
update public.plan_configs set tagline = 'Para los que están creciendo.'   where key = 'pro';
-- El de Elite ("Para cadenas y multi-sede.") ya era neutro, no se toca.

-- El ejemplo de dominio propio también decía "tugim".
update public.plan_configs
  set features = replace(features::text, 'tugim.com.ar', 'tumarca.com.ar')::jsonb
  where key = 'pro' and features::text like '%tugim.com.ar%';

-- La nota de la promo del Elite también nombraba gimnasios.
update public.plan_configs
   set promo_note = 'Primer mes a $90.000 para los que contraten ahora.'
 where key = 'elite';
