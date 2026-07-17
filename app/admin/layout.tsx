"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";

interface Item { href: string; label: string; icon: string; }

const NAV: Item[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/planes", label: "Planes", icon: "layers" },
  { href: "/admin/cobros", label: "Cobros", icon: "wallet" },
  { href: "/admin/demos", label: "Demos", icon: "robot" },
  { href: "/admin/equipo", label: "Equipo", icon: "users" },
];

function Icon({ name, className = "h-[18px] w-[18px]" }: { name: string; className?: string }) {
  const p: Record<string, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
    layers: (
      <>
        <path d="M4 7l8-4 8 4-8 4z" />
        <path d="M4 7v6l8 4 8-4V7M4 13l8 4 8-4" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2.5" />
        <path d="M3 10h18M16.5 14.5h.01" />
      </>
    ),
    robot: (
      <>
        <rect x="4" y="8" width="16" height="11" rx="3" />
        <path d="M12 8V4M8.5 13h.01M15.5 13h.01M9 19v2M15 19v2" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </>
    ),
    logout: <path d="M15 12H3m0 0l4-4m-4 4l4 4M11 3h6a2 2 0 012 2v14a2 2 0 01-2 2h-6" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {p[name] || null}
    </svg>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const pathname = usePathname();
  const [state, setState] = useState<"loading" | "denied" | "ok">("loading");
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/acceso"; return; }
      setEmail(user.email || "");
      const { data: me } = await supabase
        .from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
      const isAdmin = me?.role === "super_admin";
      if (isAdmin) {
        // Marca este navegador como "tuyo" y registra tu IP (hasheada) para NO
        // contar tus propias visitas/logins a las demos.
        try { localStorage.setItem("tg_owner", "1"); } catch { /* ignore */ }
        fetch("/api/admin/registrar-ip", { method: "POST" }).catch(() => {});
      }
      setState(isAdmin ? "ok" : "denied");
    })();
    /* eslint-disable-next-line */
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/acceso";
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  if (state === "loading") return <main className="grid min-h-screen place-items-center text-ink-2">Cargando…</main>;
  if (state === "denied") return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Acceso restringido</h1>
        <p className="mt-2 text-ink-2">Esta sección es solo para el administrador de turnogym.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-brand hover:underline">Ir a mi panel →</Link>
      </div>
    </main>
  );

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside
        className={`fixed z-40 flex h-screen w-60 flex-col gap-1 overflow-y-auto border-r border-white/[.08] bg-gradient-to-b from-[#0c1017] to-bg px-3.5 py-5 transition-transform md:sticky md:top-0 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-2.5 pb-4 pt-2">
          <div className="flex items-center gap-2.5">
            <BrandMark size={34} className="rounded-[10px]" />
            <BrandWordmark size="text-[19px]" />
          </div>
          <div className="mt-2.5 border-t border-white/[.06] pt-2.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(34,211,238,.12)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand">
              <span aria-hidden>🛡️</span> Super Admin
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const cls = `flex items-center gap-[11px] rounded-[10px] border px-3 py-[9px] text-sm font-medium transition ${
              active
                ? "border-brand/25 bg-gradient-to-r from-[rgba(34,211,238,.16)] to-[rgba(59,130,246,.10)] text-white"
                : "border-transparent text-ink-2 hover:bg-surface hover:text-ink"
            }`;
            return (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cls}>
                <span className={active ? "text-brand" : "opacity-85"}><Icon name={item.icon} /></span>
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-[11px] rounded-[10px] border border-transparent px-3 py-[9px] text-sm font-medium text-muted transition hover:bg-surface hover:text-ink"
          >
            <span className="opacity-85">←</span>
            <span className="flex-1">Volver a mi gimnasio</span>
          </Link>
        </nav>

        <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-white/[.08] bg-surface p-3">
          <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-600 to-slate-500 text-[13px] font-bold">
            {(email || "A").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold" title={email}>{email || "Administrador"}</div>
            <div className="truncate text-xs text-muted">turnogym</div>
          </div>
          <button onClick={logout} title="Cerrar sesión"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[.08] text-ink-2 transition hover:border-white/20 hover:text-crit">
            <Icon name="logout" className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} />}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-white/[.08] bg-bg/80 px-4 backdrop-blur-md md:px-7">
          <button
            onClick={() => setOpen(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[.08] bg-surface text-ink-2 md:hidden"
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <div className="hidden text-sm text-muted md:block">Panel de administración de turnogym</div>
          <Link href="/admin/demos" className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-br from-brand to-brand-2 px-4 py-2 text-[13.5px] font-semibold text-[#04121a] shadow-[0_8px_20px_rgba(34,211,238,.28)] transition hover:brightness-105">
            🤖 Generar demo
          </Link>
        </header>

        <div className="min-w-0 flex-1 px-4 py-6 md:px-7 md:py-8">{children}</div>
      </div>
    </div>
  );
}
