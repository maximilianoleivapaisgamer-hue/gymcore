-- Funciones BONIFICADAS por gimnasio.
--
-- Sirve para habilitarle a UN cliente en particular una función que su plan no
-- incluye (ej: alguien del plan Básico que quiere el control de acceso por QR),
-- sin tener que subirlo de plan ni tocar plan_configs (que afecta a todos).
--
-- Guarda las CLAVES de PlanFeature de lib/plans.ts: clases, dietas,
-- control_acceso, ia, whatsapp. Lo que esté acá se suma a lo que ya trae el
-- plan; nunca resta. En "Mi plan" el dueño las ve listadas como bonificadas.
--
-- Se carga desde el Super Admin → botón "Funciones" en la fila del gimnasio.

alter table public.gyms
  add column if not exists extra_features text[] not null default '{}';

comment on column public.gyms.extra_features is
  'Funciones habilitadas a mano para este gimnasio, además de las que trae su plan (claves de PlanFeature en lib/plans.ts). Se muestran como "bonificadas" en Mi plan.';
