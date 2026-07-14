"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { allows, minPlanLabel, loadPlans, DEFAULT_PLANS, type PlanFeature, type PlanConfig } from "@/lib/plans";
import { staffCanAccess } from "@/lib/staff";
import ThemeApply from "@/components/ThemeApply";
import { BrandMark, BrandWordmark } from "@/components/BrandMark";
import SedeSwitcher from "@/components/SedeSwitcher";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Función que requiere: si el plan no la incluye, se muestra un candado. */
  feature?: PlanFeature;
  superAdmin?: boolean;
  external?: boolean;
}
interface NavGroup { label: string; items: NavItem[]; }

const NAV: NavGroup[] = [
  {
    label: "Gestión",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/dashboard/socios", label: "Socios", icon: "users" },
      { href: "/dashboard/rutinas", label: "Rutinas", icon: "dumbbell" },
      { href: "/dashboard/dietas", label: "Dietas", icon: "salad", feature: "dietas" },
      { href: "/dashboard/finanzas", label: "Finanzas", icon: "chart" },
      { href: "/dashboard/clases", label: "Clases", icon: "calendar" },
      { href: "/dashboard/equipo", label: "Equipo", icon: "staff" },
      { href: "/dashboard/sedes", label: "Sucursales", icon: "building" },
      { href: "/dashboard/control-acceso", label: "Control de acceso", icon: "acceso", feature: "control_acceso" },
      { href: "/dashboard/planes", label: "Planes", icon: "layers" },
    ],
  },
  {
    label: "Experiencia socio",
    items: [
      { href: "/dashboard/configuracion", label: "Página pública", icon: "globe" },
    ],
  },
  {
    label: "Tu negocio",
    items: [
      { href: "/admin", label: "Super Admin", icon: "shield", superAdmin: true },
      { href: "/admin/demos", label: "Demos", icon: "sparkles", superAdmin: true },
      { href: "/dashboard/mi-plan", label: "Mi plan", icon: "star" },
    ],
  },
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
    users: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20a5.5 5.5 0 0111 0M16 5.5a3 3 0 010 5.8M18.5 20a5.2 5.2 0 00-3-4.7" />
      </>
    ),
    dumbbell: <path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11" />,
    salad: (
      <>
        <path d="M3.5 11h17a8.5 8.5 0 0 1-17 0Z" />
        <path d="M12 11c0-4 3-7 7.5-7M12 11c0-3-2.2-5.2-5.5-5.2" />
      </>
    ),
    chart: <path d="M3 3v18h18M7 15l4-5 3 3 5-7" />,
    calendar: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <path d="M3 9h18M8 2.5v4M16 2.5v4" />
      </>
    ),
    staff: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20.5c0-3.6 3.1-6 7-6s7 2.4 7 6" />
      </>
    ),
    acceso: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="1" />
        <rect x="4" y="15" width="4" height="4" rx="1" />
        <rect x="13" y="4" width="4" height="4" rx="1" />
        <path d="M13 13h3v3M20 4v6M20 15v5M13 20h7" />
      </>
    ),
    layers: (
      <>
        <path d="M4 7l8-4 8 4-8 4z" />
        <path d="M4 7v6l8 4 8-4V7M4 13l8 4 8-4" />
      </>
    ),
    phone: (
      <>
        <rect x="6" y="2.5" width="12" height="19" rx="3" />
        <path d="M10.5 18.5h3" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
      </>
    ),
    shield: (
      <>
        <path d="M12 2.5l8 3.5v5c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-5z" />
        <path d="M9 12l2 2 4-4.5" />
      </>
    ),
    star: <path d="M12 2.5l8 3.5v5c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-5z" />,
    bell: <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.5 21a2 2 0 01-3 0" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4-4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    logo: <path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11" />,
    logout: <path d="M15 12H3m0 0l4-4m-4 4l4 4M11 3h6a2 2 0 012 2v14a2 2 0 01-2 2h-6" />,
    building: (
      <>
        <path d="M3 21h18M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6M9 10h.01M15 10h.01M9 14h.01M15 14h.01" />
      </>
    ),
    sparkles: <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 14l.9 2.4 2.4.9-2.4.9L19 21l-.9-2.4-2.4-.9 2.4-.9z" />,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {p[name] || null}
    </svg>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const pathname = usePathname();
  const router = useRouter();
  const [gym, setGym] = useState<{ name: string; logo_url: string | null; theme: string; bg_style: string } | null>(null);
  const [email, setEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanConfig[]>(DEFAULT_PLANS);
  const [role, setRole] = useState<string>("owner");
  const [perms, setPerms] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");
      const { data: profile } = await supabase
        .from("profiles").select("gym_id, role, full_name, permissions").eq("id", user.id)
        .single<{ gym_id: string; role: string; full_name: string | null; permissions: string[] | null }>();
      setRole(profile?.role || "owner");
      setFullName(profile?.full_name || "");
      setPerms(profile?.permissions || []);
      if (profile?.gym_id) {
        const [{ data: g }, { data: sub }] = await Promise.all([
          supabase.from("gyms").select("name, logo_url, theme, bg_style").eq("id", profile.gym_id)
            .single<{ name: string; logo_url: string | null; theme: string; bg_style: string }>(),
          supabase.from("subscriptions").select("plan").eq("gym_id", profile.gym_id)
            .maybeSingle<{ plan: string }>(),
        ]);
        setGym(g ?? null);
        setPlan(sub?.plan ?? null);
        setPlans(await loadPlans(supabase));
      }
    })();
    /* eslint-disable-next-line */
  }, []);

  // Si un empleado entra a una sección que no tiene habilitada, lo mandamos al inicio.
  useEffect(() => {
    if (role === "empleado" && !staffCanAccess(pathname, perms)) {
      router.replace("/dashboard");
    }
  }, [role, perms, pathname, router]);

  function visibleItems(items: NavItem[]) {
    return items.filter((item) => {
      if (item.superAdmin && role !== "super_admin") return false;
      if (role === "empleado") return staffCanAccess(item.href, perms);
      return true;
    });
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/acceso";
  }

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const initials = (fullName || email || "G").slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen">
      <ThemeApply theme={gym?.theme} />
      {/* Sidebar */}
      <aside
        className={`fixed z-40 flex h-screen w-64 flex-col gap-1 overflow-y-auto border-r border-white/[.08] bg-gradient-to-b from-[#0c1017] to-bg px-3.5 py-5 transition-transform md:sticky md:top-0 md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand: turnogym (plataforma) arriba + gimnasio del dueño abajo */}
        <div className="px-2.5 pb-4 pt-2">
          <div className="flex items-center gap-2.5">
            <BrandMark size={34} className="rounded-[10px]" />
            <BrandWordmark size="text-[19px]" />
          </div>
          <div className="mt-2.5 flex items-center gap-2 border-t border-white/[.06] pt-2.5">
            {gym?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={gym.logo_url} alt="" className="h-6 w-6 shrink-0 rounded-md bg-white/5 object-contain p-0.5" />
            ) : (
              <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/5 text-[11px] font-bold text-ink-2">
                {(gym?.name || "G").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold leading-tight">{gym?.name || "Tu gimnasio"}</div>
              <div className="text-[10px] font-medium text-muted">Panel del gimnasio</div>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((group) => {
            const items = visibleItems(group.items);
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                <div className="px-3 pb-1.5 pt-3.5 text-[10.5px] font-semibold uppercase tracking-[.9px] text-muted">
                  {group.label}
                </div>
                {items.map((item) => {
                  const active = !item.external && isActive(item.href);
                  const inner = (
                    <>
                      <span className={active ? "text-brand" : "opacity-85"}><Icon name={item.icon} /></span>
                      <span className="flex-1">{item.label}</span>
                      {item.feature && !allows(plans, plan, item.feature) && (
                        <span className="rounded-full bg-[rgba(245,177,61,.14)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#f5b13d]">
                          {minPlanLabel(plans, item.feature)}
                        </span>
                      )}
                    </>
                  );
                  const cls = `flex items-center gap-[11px] rounded-[10px] border px-3 py-[9px] text-sm font-medium transition ${
                    active
                      ? "border-brand/25 bg-gradient-to-r from-[rgba(34,211,238,.16)] to-[rgba(59,130,246,.10)] text-white"
                      : "border-transparent text-ink-2 hover:bg-surface hover:text-ink"
                  }`;
                  return item.external ? (
                    <a key={item.href} href={item.href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
                  ) : (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cls}>{inner}</Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User card + logout */}
        <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-white/[.08] bg-surface p-3">
          <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-600 to-slate-500 text-[13px] font-bold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold" title={fullName || email}>{fullName || email || "Mi cuenta"}</div>
            <div className="truncate text-xs text-muted">{gym?.name || "turnogym"}</div>
          </div>
          <button onClick={logout} title="Cerrar sesión"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/[.08] text-ink-2 transition hover:border-white/20 hover:text-crit">
            <Icon name="logout" className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} />}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/[.08] bg-bg/80 px-4 backdrop-blur-md md:px-7">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[.08] bg-surface text-ink-2 md:hidden"
              aria-label="Abrir menú"
            >
              ☰
            </button>
            <div className="hidden w-[340px] items-center gap-2.5 rounded-[10px] border border-white/[.08] bg-surface px-3 py-2 text-muted sm:flex">
              <Icon name="search" className="h-4 w-4" />
              <input
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                placeholder="Buscar socios, clases, movimientos…"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SedeSwitcher role={role} />
            <button className="grid h-[38px] w-[38px] place-items-center rounded-[10px] border border-white/[.08] bg-surface text-ink-2 transition hover:border-white/20 hover:text-white" aria-label="Notificaciones">
              <Icon name="bell" className="h-[18px] w-[18px]" />
            </button>
            <Link
              href="/dashboard/socios"
              className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-br from-brand to-brand-2 px-4 py-2.5 text-[13.5px] font-semibold text-[#04121a] shadow-[0_8px_20px_rgba(34,211,238,.28)] transition hover:brightness-105"
            >
              <Icon name="plus" className="h-4 w-4" /> Nuevo
            </Link>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
