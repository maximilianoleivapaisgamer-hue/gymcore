"use client";

import { useEffect, useState } from "react";
import PasswordInput from "@/components/PasswordInput";

export default function MiCuentaPage() {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [isSynthetic, setIsSynthetic] = useState(false);

  const [nuevoUser, setNuevoUser] = useState("");
  const [userBusy, setUserBusy] = useState(false);
  const [userMsg, setUserMsg] = useState("");
  const [userErr, setUserErr] = useState("");

  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [passBusy, setPassBusy] = useState(false);
  const [passMsg, setPassMsg] = useState("");
  const [passErr, setPassErr] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/cuenta").then((x) => x.json()).catch(() => null);
      if (r?.ok) { setUsername(r.username); setEmail(r.email); setIsSynthetic(r.isSynthetic); setNuevoUser(r.username || ""); }
      setLoading(false);
    })();
  }, []);

  async function guardarUsuario() {
    setUserErr(""); setUserMsg("");
    const nuevo = nuevoUser.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (nuevo.length < 4) { setUserErr("Al menos 4 letras o números, sin espacios ni símbolos."); return; }
    if (nuevo === username) { setUserErr("Es el mismo usuario que ya tenés."); return; }
    setUserBusy(true);
    const r = await fetch("/api/cuenta", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "usuario", newUser: nuevo }),
    }).then((x) => x.json()).catch(() => null);
    setUserBusy(false);
    if (r?.ok) { setUsername(r.username); setNuevoUser(r.username); setUserMsg(`Listo. La próxima vez entrá con el usuario: ${r.username}`); }
    else setUserErr(r?.error || "No se pudo cambiar el usuario.");
  }

  async function guardarClave() {
    setPassErr(""); setPassMsg("");
    if (pass.length < 6) { setPassErr("La contraseña debe tener al menos 6 caracteres."); return; }
    if (pass !== pass2) { setPassErr("Las dos contraseñas no coinciden."); return; }
    setPassBusy(true);
    const r = await fetch("/api/cuenta", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "clave", newPass: pass }),
    }).then((x) => x.json()).catch(() => null);
    setPassBusy(false);
    if (r?.ok) { setPass(""); setPass2(""); setPassMsg("¡Contraseña actualizada!"); }
    else setPassErr(r?.error || "No se pudo cambiar la contraseña.");
  }

  if (loading) return <div className="grid min-h-[40vh] place-items-center text-ink-2">Cargando…</div>;

  return (
    <div className="mx-auto w-full max-w-2xl p-5 md:p-7">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <p className="mt-1 text-ink-2">Cambiá tu usuario de acceso y tu contraseña.</p>
      </div>

      {/* Usuario */}
      {isSynthetic ? (
        <div className="card mb-4">
          <div className="mb-1 text-sm font-semibold">Usuario de acceso</div>
          <p className="mb-3 text-xs text-ink-2">Con este usuario entrás a tu panel en <b>turnogym.com/acceso</b>. Actual: <b className="text-ink">{username}</b></p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="input flex-1" value={nuevoUser} onChange={(e) => setNuevoUser(e.target.value)} placeholder="nuevo usuario (ej: cefagym)" />
            <button className="btn btn-primary shrink-0" onClick={guardarUsuario} disabled={userBusy}>{userBusy ? "Guardando…" : "Cambiar usuario"}</button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">Solo minúsculas y números, sin espacios. La contraseña no cambia al cambiar el usuario.</p>
          {userMsg && <p className="mt-2 text-sm text-good">{userMsg}</p>}
          {userErr && <p className="mt-2 text-sm text-crit">{userErr}</p>}
        </div>
      ) : (
        <div className="card mb-4">
          <div className="mb-1 text-sm font-semibold">Usuario de acceso</div>
          <p className="text-xs text-ink-2">Entrás con tu email: <b className="text-ink">{email}</b></p>
        </div>
      )}

      {/* Contraseña */}
      <div className="card">
        <div className="mb-1 text-sm font-semibold">Contraseña</div>
        <p className="mb-3 text-xs text-ink-2">Elegí una contraseña nueva.</p>
        <div className="flex flex-col gap-2">
          <PasswordInput value={pass} onChange={setPass} placeholder="Nueva contraseña" autoComplete="new-password" />
          <PasswordInput value={pass2} onChange={setPass2} placeholder="Repetir la contraseña" autoComplete="new-password" />
          <button className="btn btn-primary" onClick={guardarClave} disabled={passBusy}>{passBusy ? "Guardando…" : "Cambiar contraseña"}</button>
        </div>
        {passMsg && <p className="mt-2 text-sm text-good">{passMsg}</p>}
        {passErr && <p className="mt-2 text-sm text-crit">{passErr}</p>}
      </div>
    </div>
  );
}
