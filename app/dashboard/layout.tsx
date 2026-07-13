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
  elite?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: "home" },
  { href: "/dashboard/socios", label: "Socios", icon: "users" },
  { href: "/dashboard/rutinas", label: "Rutinas", icon: "dumbbell" },
  { href: "/dashboard/dietas", label: "Dietas", icon: "salad", elite: true },
  { href: "/dashboard/finanzas", label: "Finanzas", icon: "dollar" },
  { href: "/dashboard/clases", label: "Clases", icon: "calendar" },
  { href: "/dashboard/equipo", label: "Equipo", icon: "staff" },
  { href: "/dashboard/planes", label: "Planes", icon: "card" },
  { href: "/dashboard/configuracion", label: "Mi página", icon: "page" },
  { href: "/dashboard/mi-plan", label: "Mi plan", icon: "star" },
];

/** Íconos de línea profesionales para cada sección (SVG, heredan el color). */
function NavIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: <path d="M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9" />,
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5M16.5 6a3 3 0 0 1 0 6M21 20c0-2-1.4-3.6-3.8-4.2" />
      </>
    ),
    dumbbell: <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />,
    salad: (
      <>
        <path d="M3.5 11h17a8.5 8.5 0 0 1-17 0Z" />
        <path d="M12 11c0-4 3-7 7.5-7M12 11c0-3-2.2-5.2-5.5-5.2" />
      </>
    ),
    dollar: (
      <>
        <path d="M12 2.5v19" />
        <path d="M16.5 6.5c0-1.6-2-2.8-4.5-2.8S7.5 4.9 7.5 6.7s1.8 2.4 4.5 2.9 4.5 1.1 4.5 2.9-2 2.8-4.5 2.8-4.5-1.1-4.5-2.7" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
      </>
    ),
    staff: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20.5c0-3.6 3.1-6 7-6s7 2.4 7 6" />
      </>
    ),
    card: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
    page: (
      <>
        <path d="M6 3h7.5L18 7.5V21H6z" />
        <path d="M13 3v5h5M9.5 13h5M9.5 17h5" />
      </>
    ),
    star: <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1-5.4-2.9-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
}
/** Ítems que un empleado (rol "empleado") no debería ver, salvo Finanzas que
 * depende del flag employees_see_finance del gimnasio (se filtra aparte). */
const OWNER_ONLY_HREFS = ["/dashboard/planes", "/dashboard/configuracion", "/dashboard/mi-plan"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const [gym, setGym] = useState<{ name: string; logo_url: string | null } | null>(null);
  const [email, setEmail] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [isElite, setIsElite] = useState(false);
  const [role, setRole] = useState<string>("owner");
  const [seeFinance, setSeeFinance] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");
      const { data: profile } = await supabase
        .from("profiles").select("gym_id, role").eq("id", user.id).single<{ gym_id: string; role: string }>();
      setRole(profile?.role || "owner");
      if (profile?.gym_id) {
        const [{ data: g }, { data: sub }] = await Promise.all([
          supabase.from("gyms").select("name, logo_url, employees_see_finance").eq("id", profile.gym_id)
            .single<{ name: string; logo_url: string | null; employees_see_finance: boolean }>(),
          supabase.from("subscriptions").select("plan").eq("gym_id", profile.gym_id)
            .maybeSingle<{ plan: string }>(),
        ]);
        setGym(g ?? null);
        setIsElite(sub?.plan === "elite");
        setSeeFinance(profile.role !== "empleado" || !!g?.employees_see_finance);
      }
    })();
    /* eslint-disable-next-line */
  }, []);

  const visibleNav = NAV.filter((item) => {
    if (role === "empleado") {
      if (OWNER_ONLY_HREFS.includes(item.href)) return false;
      if (item.href === "/dashboard/finanzas" && !seeFinance) return false;
    }
    return true;
  });

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/acceso";
  }

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      <div className="aurora" aria-hidden="true" />
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
          {visibleNav.map((item) =>
            item.soon ? (
              <div
                key={item.href}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted"
                title="Próximamente"
              >
                <span className="opacity-70"><NavIcon name={item.icon} /></span>
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
                <span className={isActive(item.href) ? "text-brand" : ""}><NavIcon name={item.icon} /></span>
                <span className="flex-1">{item.label}</span>
                {item.elite && !isElite && (
                  <span className="rounded-full bg-[rgba(245,177,61,.14)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#f5b13d]">
                    Elite
                  </span>
                )}
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
