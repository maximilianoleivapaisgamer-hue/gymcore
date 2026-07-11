"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  soon?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: "▚" },
  { href: "/dashboard/socios", label: "Socios", icon: "◉" },
  { href: "/dashboard/rutinas", label: "Rutinas", icon: "◈" },
  { href: "/dashboard/finanzas", label: "Finanzas", icon: "◆" },
  { href: "/dashboard/clases", label: "Clases", icon: "◑" },
  { href: "/dashboard/configuracion", label: "Mi página", icon: "❖" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const [gym, setGym] = useState<{ name: string; logo_url: string | null } | null>(null);
  const [email, setEmail] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");
      const { data: profile } = await supabase
        .from("profiles").select("gym_id").eq("id", user.id).single<{ gym_id: string }>();
      if (profile?.gym_id) {
        const { data: g } = await supabase
          .from("gyms").select("name, logo_url").eq("id", profile.gym_id)
          .single<{ name: string; logo_url: string | null }>();
        setGym(g ?? null);
      }
    })();
    /* eslint-disable-next-line */
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/acceso";
  }

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`fixed z-40 flex h-screen w-64 flex-col border-r border-white/10 bg-surface transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          {gym?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gym.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-2 text-sm font-black text-black">
              {(gym?.name || "G").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{gym?.name || "Mi Gimnasio"}</div>
            <div className="text-[11px] text-muted">GymCore</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) =>
            item.soon ? (
              <div
                key={item.href}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted"
                title="Próximamente"
              >
                <span className="text-base opacity-70">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-2">
                  Pronto
                </span>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive(item.href)
                    ? "bg-gradient-to-r from-brand/15 to-brand-2/10 font-semibold text-ink"
                    : "text-ink-2 hover:bg-white/[.04] hover:text-ink"
                }`}
              >
                <span className={`text-base ${isActive(item.href) ? "text-brand" : ""}`}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          )}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 truncate px-2 text-xs text-muted" title={email}>{email}</div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-2 transition hover:bg-white/[.04] hover:text-crit"
          >
            <span>⏻</span> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 md:hidden">
          <button
            onClick={() => setOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-surface-2"
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <span className="text-sm font-semibold">{gym?.name || "GymCore"}</span>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
