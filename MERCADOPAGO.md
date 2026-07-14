# Pagos con Mercado Pago (abono del gimnasio)

El dueño de un gimnasio puede **cambiar/activar su plan desde "Mi Plan"**: elige
el plan, paga con Mercado Pago (débito automático mensual) y, al confirmarse el
pago, **el plan se activa solo** y se le habilitan las funciones.

## Cómo funciona

1. En **Mi Plan**, el dueño toca "Cambiar a {plan}".
2. El servidor crea una **suscripción (preapproval)** en Mercado Pago por el
   precio del plan y lo redirige al checkout de MP para autorizar su tarjeta.
3. MP cobra ese monto todos los meses y avisa por **webhook**.
4. El webhook actualiza la suscripción del gimnasio (plan + estado "activo" +
   próximo vencimiento). Las funciones se desbloquean al instante.

## Variables de entorno (Vercel → Project Settings → Environment Variables)

| Variable | Obligatoria | Para qué |
|---|---|---|
| `MP_ACCESS_TOKEN` | **Sí** | Access Token de tu cuenta de Mercado Pago (Mercado Pago → Tus integraciones → Credenciales de **producción**). |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sí** | Ya la tenés. La usa el servidor para activar el plan. |
| `NEXT_PUBLIC_APP_URL` | Recomendada | La URL pública de tu app (ej `https://gymcore-rosy.vercel.app`). Se usa para el retorno y el webhook. Si no la cargás, se deduce del dominio del pedido. |

> El `MP_ACCESS_TOKEN` **nunca** se expone al navegador: solo lo usan las rutas
> de servidor. No lo pegues en el chat; cargalo directo en Vercel.

## Webhook

Al crear la suscripción ya se envía el `notification_url` apuntando a:

```
https://TU-DOMINIO/api/pagos/webhook
```

Si en el panel de Mercado Pago te piden configurar la URL de notificaciones a
mano, usá esa misma.

## Archivos

```
lib/mercadopago.ts             Cliente de la API de MP (fetch, sin SDK)
app/api/pagos/crear/route.ts   Crea la suscripción y devuelve el link de pago
app/api/pagos/webhook/route.ts Recibe el aviso de MP y activa el plan
supabase/migration_012_mp_preapproval.sql  Columna mp_preapproval_id
```
Y los botones "Cambiar a {plan}" en `app/dashboard/mi-plan/page.tsx`.

## Notas

- Mientras no cargues `MP_ACCESS_TOKEN`, los botones muestran un aviso de que
  los pagos todavía no están configurados (no rompen nada).
- La **promo del primer mes** (ej. Elite a $90.000) hoy es informativa: la
  suscripción cobra el precio mensual normal. Para cobrar distinto el primer mes
  hay que sumar una promoción/plan aparte en Mercado Pago; lo vemos si lo querés.
- Conviene probar primero con credenciales de **prueba** (sandbox) de MP antes de
  pasar a producción.
