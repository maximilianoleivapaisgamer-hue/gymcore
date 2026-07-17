"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

interface Admin { id: string; email: string; full_name: string | null; }

/**
 * Equipo (solo super admin): ver quién tiene acceso de super admin, sumar a
 * alguien por su email y sacarle el acceso. No te podés sacar a vos mismo.
 */
export default function EquipoPage() {
  const supabase = createClient();
  const [meId, setMeId] = useState<string>("");
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setMeId(user?.id || "");
      const r = await fetch("/api/admin/equipo", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      }).then((x) => x.json()).catch(() => null);
      if (r?.ok) setAdmins(r.admins);
      setLoading(false);
    })();
    /* eslint-disable-next-line */
  }, []);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    const r = await fetch("/api/admin/equipo", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "grant", email: email.trim() }),
    }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (!r?.ok) { setErr(r?.error || "No se pudo."); return; }
    setAdmins(r.admins);
    setMsg(`Listo, ${email.trim()} ahora es super admin.`);
    setEmail("");
  }

  async function revoke(a: Admin) {
    if (!confirm(`¿Sacarle el acceso de super admin a ${a.email}? Va a dejar de ver el panel de administración.`)) return;
    setErr(""); setMsg(""); setBusy(true);
    const r = await fetch("/api/admin/equipo", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "revoke", userId: a.id }),
    }).then((x) => x.json()).catch(() => null);
    setBusy(false);
    if (!r?.ok) { setErr(r?.error || "No se pudo."); return; }
    setAdmins(r.admins);
    setMsg(`Le sacamos el super admin a ${a.email}.`);
  }

  return (
    <div className="w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Equipo</h1>
        <p className="mt-1 text-ink-2">Quién puede administrar turnogym. Sumá a alguien de confianza por su email.</p>
      </div>

      <form onSubmit={grant} className="card mb-6">
        <label className="mb-1 block text-sm font-semibold">Hacer super admin</label>
        <p className="mb-3 text-xs text-ink-2">
          La persona tiene que estar registrada en turnogym (con ese mismo email). Pegá su email y le damos acceso total.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input flex-1"
            type="email"
            placeholder="email@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn btn-primary shrink-0" disabled={busy}>
            {busy ? "Guardando…" : "Hacer super admin"}
          </button>
        </div>
        {msg && <p className="mt-3 text-sm text-good">{msg}</p>}
        {err && <p className="mt-3 text-sm text-crit">{err}</p>}
      </form>

      <div className="card p-0">
        <div className="border-b border-white/10 p-4 text-sm font-semibold">
          Super admins ({admins.length})
        </div>
        {loading ? (
          <p className="p-6 text-center text-ink-2">Cargando…</p>
        ) : admins.length === 0 ? (
          <p className="p-6 text-center text-ink-2">No hay super admins todavía.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {admins.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{a.email}</div>
                  {a.full_name && <div className="truncate text-xs text-muted">{a.full_name}</div>}
                </div>
                {a.id === meId ? (
                  <span className="shrink-0 rounded-full bg-[rgba(34,211,238,.12)] px-2.5 py-1 text-[11px] font-semibold text-brand">Vos</span>
                ) : (
                  <button
                    onClick={() => revoke(a)}
                    disabled={busy}
                    className="shrink-0 rounded-lg border border-white/[.08] px-3 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-crit/40 hover:text-crit disabled:opacity-50"
                  >
                    Sacar acceso
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
