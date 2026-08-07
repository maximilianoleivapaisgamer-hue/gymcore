/**
 * Cliente mínimo de la WhatsApp Cloud API (Meta), sin SDK.
 *
 * El TOKEN es central (tu system-user token de Tech Provider): con él se puede
 * enviar por el número de CADA gimnasio. Lo que cambia por gimnasio es el
 * phone_number_id (el identificador del número de ese gym), que se guarda en
 * gyms.wa_phone_id.
 *
 * Variables de entorno (Vercel → Environment Variables):
 *   - WHATSAPP_TOKEN     → tu Access Token (system user) de Meta
 *   - WHATSAPP_TEMPLATE  → nombre de la plantilla aprobada (ej "recordatorio_cuota")
 *   - WHATSAPP_LANG      → idioma de la plantilla (ej "es" o "es_AR"). Por defecto "es".
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export function waConfigured(): boolean {
  return !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_TEMPLATE;
}

/** Normaliza un número a solo dígitos con código de país (best-effort para AR). */
export function normalizePhone(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("54")) return d;          // ya tiene código de país
  if (d.startsWith("0")) d = d.slice(1);     // saca el 0 inicial
  if (d.startsWith("15")) d = d.slice(2);    // saca el 15 de celular
  // Si parece un número local argentino, le anteponemos 54 9 (celular).
  if (d.length >= 10) return `549${d}`;
  return d;
}

/** Envía la plantilla aprobada por el número del gimnasio (phoneId). params = variables {{1}}, {{2}}… */
export async function sendTemplate(opts: { phoneId: string; to: string; params: (string | number)[] }): Promise<{ id: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  const template = process.env.WHATSAPP_TEMPLATE;
  const lang = process.env.WHATSAPP_LANG || "es";
  if (!token) throw new Error("Falta WHATSAPP_TOKEN en el servidor.");
  if (!template) throw new Error("Falta WHATSAPP_TEMPLATE en el servidor.");
  if (!opts.phoneId) throw new Error("Este gimnasio no tiene número de WhatsApp configurado.");
  const to = normalizePhone(opts.to);
  if (!to) throw new Error("Número de destino inválido.");

  const res = await fetch(`${GRAPH}/${opts.phoneId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: lang },
        components: [
          { type: "body", parameters: opts.params.map((t) => ({ type: "text", text: String(t) })) },
        ],
      },
    }),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error?.message || `WhatsApp ${res.status}`);
  return { id: j?.messages?.[0]?.id || "" };
}
