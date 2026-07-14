/**
 * Cliente mínimo de la API de Mercado Pago (sin SDK, con fetch).
 *
 * Usa "Suscripciones" (preapproval): un débito automático mensual por el monto
 * del plan. El dueño autoriza su tarjeta una vez en el checkout de MP, y desde
 * ahí MP cobra todos los meses y nos avisa por webhook.
 *
 * Variable de entorno (en Vercel → Project Settings → Environment Variables):
 *   - MP_ACCESS_TOKEN  → Access Token de tu cuenta de Mercado Pago
 *     (Mercado Pago → Tus integraciones → Credenciales de producción).
 *   La clave NUNCA se expone al cliente: solo se usa en rutas de servidor.
 */

const MP_API = "https://api.mercadopago.com";

export function mpConfigured(): boolean {
  return !!process.env.MP_ACCESS_TOKEN;
}

function token(): string {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error("Falta MP_ACCESS_TOKEN en el servidor. Cargalo en Vercel.");
  return t;
}

async function mpFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token()}`,
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* respuesta no-JSON */ }
  if (!res.ok) {
    const msg = json?.message || text || `HTTP ${res.status}`;
    throw new Error(`Mercado Pago ${res.status}: ${String(msg).slice(0, 300)}`);
  }
  return json;
}

export interface CreatePreapprovalInput {
  reason: string;          // descripción (ej "GymCore - Plan Pro")
  amount: number;          // monto mensual en ARS
  payerEmail: string;      // email del dueño
  backUrl: string;         // adónde vuelve tras autorizar
  notificationUrl: string; // webhook
  externalReference: string; // gymId|plan para reconciliar
}

/** Crea la suscripción (preapproval) y devuelve el link para autorizar la tarjeta. */
export async function createPreapproval(i: CreatePreapprovalInput): Promise<{ id: string; init_point: string }> {
  const data = await mpFetch("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: i.reason,
      external_reference: i.externalReference,
      payer_email: i.payerEmail,
      back_url: i.backUrl,
      notification_url: i.notificationUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: Math.round(i.amount),
        currency_id: "ARS",
      },
      status: "pending",
    }),
  });
  return { id: data.id, init_point: data.init_point || data.sandbox_init_point };
}

/** Consulta el estado de una suscripción. */
export async function getPreapproval(id: string): Promise<any> {
  return mpFetch(`/preapproval/${id}`);
}

/** Consulta un pago (para webhooks de tipo payment). */
export async function getPayment(id: string): Promise<any> {
  return mpFetch(`/v1/payments/${id}`);
}
