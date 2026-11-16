"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, Bot, CalendarClock, Calculator, ClipboardList, Search, LayoutDashboard, LogOut, Menu, Moon, PackageSearch, Package, Settings, ShoppingCart, Sun, Tag, Target, Truck, Users, Wallet, Receipt, X, Store } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { cn, ToastProvider } from "./ui";

const NAV = [
  { group: "Pilotage", items: [
    { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
    { href: "/assistant", label: "Centre de contrôle IA", icon: Bot },
    { href: "/agents", label: "Agents", icon: Users },
    { href: "/automatisation", label: "Automatisation", icon: CalendarClock },
  ] },
  { group: "Acheter", items: [
    { href: "/opportunites", label: "Opportunités", icon: Target },
    { href: "/simulateur", label: "Simulateur", icon: Calculator },
    { href: "/sources", label: "Sources & fournisseurs", icon: PackageSearch },
    { href: "/achats", label: "Achats", icon: ShoppingCart },
  ] },
  { group: "Vendre", items: [
    { href: "/stock", label: "Stock", icon: Package },
    { href: "/annonces", label: "Annonces", icon: Tag },
    { href: "/vinted", label: "Vinted", icon: Store },
    { href: "/ventes", label: "Ventes", icon: Receipt },
    { href: "/expeditions", label: "Expéditions", icon: Truck },
  ] },
  { group: "Gérer", items: [
    { href: "/finance", label: "Finance", icon: Wallet },
    { href: "/notifications", label: "Notifications", icon: ClipboardList },
    { href: "/parametres", label: "Paramètres", icon: Settings },
  ] },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <nav className="flex h-full flex-col gap-4 overflow-y-auto p-3" aria-label="Navigation principale">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-2 px-2 py-1.5">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-sm font-bold text-accentfg">R</span>
        <span className="font-semibold tracking-tight">Reseller AI OS</span>
      </Link>
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted">{g.group}</div>
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} onClick={onNavigate} aria-current={active(i.href) ? "page" : undefined}
              className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition", active(i.href) ? "bg-accentsoft font-medium text-accent" : "text-muted hover:bg-surface2 hover:text-ink")}>
              <i.icon className="size-4" />{i.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

type Hit = { type: string; title: string; sub: string; href: string };
function SearchBox() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); ref.current?.focus(); } if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const c = new AbortController();
    const t = setTimeout(() => api<Hit[]>(`/search?q=${encodeURIComponent(q)}`, { signal: c.signal }).then(setHits).catch(() => {}), 200);
    return () => { clearTimeout(t); c.abort(); };
  }, [q]);
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted" />
      <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Rechercher produit, vente, commande…  (Ctrl K)" aria-label="Recherche globale"
        className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm focus:border-accent focus:outline-none" />
      {open && q.trim().length >= 2 && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="anim-pop absolute z-40 mt-1 max-h-96 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
            {hits.length === 0 ? <div className="px-3 py-4 text-sm text-muted">Aucun résultat</div> : hits.map((h, i) => (
              <button key={i} onClick={() => { setOpen(false); setQ(""); router.push(h.href); }} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface2">
                <span className="truncate">{h.title}<span className="ml-2 text-xs text-muted">{h.sub}</span></span>
                <span className="shrink-0 text-xs text-muted">{h.type}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Bell_() {
  const { data } = useApi<{ unread: number }>("/notifications?unread=true&limit=1");
  const [n, setN] = useState(0);
  useEffect(() => { if (data) setN(data.unread); }, [data]);
  useEffect(() => {
    const t = setInterval(() => api<{ unread: number }>("/notifications?unread=true&limit=1").then((d) => setN(d.unread)).catch(() => {}), 20000);
    return () => clearInterval(t);
  }, []);
  return (
    <Link href="/notifications" aria-label={`Notifications (${n} non lues)`} className="relative rounded-lg p-2 text-muted hover:bg-surface2">
      <Bell className="size-5" />
      {n > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accentfg">{n > 99 ? "99+" : n}</span>}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(false);
  const router = useRouter();
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const d = !dark; setDark(d);
    document.documentElement.classList.toggle("dark", d);
    try { localStorage.setItem("theme", d ? "dark" : "light"); } catch { /* ignore */ }
  };
  return (
    <ToastProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
        <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block"><Sidebar /></aside>
        {menu && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMenu(false)} />
            <aside className="anim-in absolute inset-y-0 left-0 w-72 bg-surface shadow-xl">
              <button onClick={() => setMenu(false)} aria-label="Fermer le menu" className="absolute right-2 top-3 rounded-md p-1.5 text-muted"><X className="size-5" /></button>
              <Sidebar onNavigate={() => setMenu(false)} />
            </aside>
          </div>
        )}
        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/85 px-4 py-2.5 backdrop-blur">
            <button onClick={() => setMenu(true)} aria-label="Ouvrir le menu" className="rounded-lg p-2 text-muted hover:bg-surface2 lg:hidden"><Menu className="size-5" /></button>
            <SearchBox />
            <div className="ml-auto flex items-center gap-1">
              <Bell_ />
              <button onClick={toggle} aria-label="Basculer le thème" className="rounded-lg p-2 text-muted hover:bg-surface2">{dark ? <Sun className="size-5" /> : <Moon className="size-5" />}</button>
              <button onClick={async () => { await api("/auth/logout", { method: "POST", body: {} }); router.push("/login"); }} aria-label="Se déconnecter" className="rounded-lg p-2 text-muted hover:bg-surface2"><LogOut className="size-5" /></button>
            </div>
          </header>
          <main className="mx-auto max-w-[1400px] p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
