"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppBackground from "@/components/AppBackground";
import { BrandMark } from "@/components/BrandMark";

interface Data {
  gym: { name: string; slug: string; logo: string | null };
  yaActivo: boolean;
  ownerUser: string;
}

export default function ActivarListoPage() {
  const slug = String(useParams()?.slug || "");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/pagos/activar?slug=${encodeURIComponent(slug)}`).then((x) => x.json()).catch(() => null);
      if (r?.ok) setData(r);
      setLoading(false);
    })();
  }, [slug]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <AppBackground style="aurora" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          {data?.gym.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.gym.logo} alt="" className="mx-auto mb-3 h-14 w-14 rounded-2xl object-contain" />
          ) : (
            <BrandMark size={52} className="mx-auto mb-3 rounded-2xl" />
          )}
          <div className="mb-1 text-4xl">🎉</div>
          <h1 className="text-2xl font-bold">¡Gracias!</h1>
          <p className="mt-1 text-sm text-ink-2">
            Estamos confirmando tu pago. Apenas se acredita (unos minutos), tu gimnasio queda activo y tu web online con tu marca. Mientras tanto, ya podés entrar:
          </p>
        </div>

        {loading ? (
          <div className="card text-center text-ink-2">Cargando tus accesos…</div>
        ) : !data ? (
          <div className="card text-center text-ink-2">Listo. Te enviaremos tus accesos a la brevedad.</div>
        ) : (
          <div className="card flex flex-col gap-3 text-sm">
            {data.ownerUser && (
              <div className="rounded-lg border border-brand/25 bg-[rgba(34,211,238,.06)] p-3">
                <div className="text-xs font-semibold text-brand">🖥️ Tu panel de gestión</div>
                <a href="/acceso" className="break-all text-brand hover:underline">{origin}/acceso</a>
                <div className="mt-1.5 text-xs text-muted">Tu usuario y tu contraseña son <b className="text-ink">el mismo</b>:</div>
                <div className="text-lg font-bold">{data.ownerUser}</div>
                <p className="mt-1 text-[11px] text-muted">O sea: en <b>usuario</b> ponés <b className="text-ink">{data.ownerUser}</b> y en <b>contraseña</b> también <b className="text-ink">{data.ownerUser}</b>. Cuando entres, podés cambiar tu usuario y contraseña desde tu panel → <b>Mi cuenta</b>.</p>
              </div>
            )}
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-xs font-semibold text-ink-2">🌐 Tu web</div>
              <a href={`/${data.gym.slug}`} target="_blank" rel="noreferrer" className="break-all text-brand hover:underline">{origin}/{data.gym.slug}</a>
            </div>
            <a href="/acceso" className="btn btn-primary text-center">Entrar a mi panel</a>
          </div>
        )}
      </div>
    </main>
  );
}
