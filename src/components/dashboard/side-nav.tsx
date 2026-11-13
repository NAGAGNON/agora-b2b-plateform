"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  FileStack,
  Heart,
  Home,
  KanbanSquare,
  MessageSquare,
  Settings,
  User,
  BellRing,
  PlusCircle,
  Sparkles,
  CreditCard,
  Mail,
  Users,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/cn";

const GROUPS = [
  {
    title: "Mon activité",
    links: [
      { href: "/dashboard", label: "Tableau de bord", icon: Home, exact: true },
      { href: "/dashboard/opportunites", label: "Opportunités", icon: FileStack },
      { href: "/dashboard/recommandations", label: "Recommandations", icon: Sparkles },
      { href: "/dashboard/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/dashboard/favoris", label: "Favoris", icon: Heart },
    ],
  },
  {
    title: "Réseau",
    links: [
      { href: "/dashboard/suivies", label: "Entreprises suivies", icon: Users },
      { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Veille",
    links: [
      { href: "/dashboard/alertes", label: "Alertes", icon: BellRing },
      { href: "/dashboard/veille", label: "Veille par e-mail", icon: Mail },
      { href: "/dashboard/visibilite", label: "Visibilité", icon: Megaphone },
    ],
  },
  {
    title: "Compte",
    links: [
      { href: "/dashboard/profil", label: "Profil", icon: User },
      { href: "/dashboard/entreprise", label: "Entreprise", icon: Building2 },
      { href: "/dashboard/abonnement", label: "Mon abonnement", icon: CreditCard },
      { href: "/dashboard/parametres", label: "Paramètres", icon: Settings },
    ],
  },
];
const LINKS = GROUPS.flatMap((g) => g.links);


export function DashboardNav({ unreadMessages = 0 }: { unreadMessages?: number }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  return (
    <>
      {/* Mobile / tablette : barre défilante */}
      <nav aria-label="Mon espace" className="relative -mx-4 mb-6 overflow-x-auto border-b border-slate-200 px-4 lg:hidden">
        <ul className="flex gap-1 pb-2">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={isActive(l.href, l.exact) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition",
                  isActive(l.href, l.exact) ? "bg-navy text-white shadow-md" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-navy",
                )}
              >
                <l.icon className="size-4" aria-hidden />
                {l.label}
                {l.href === "/dashboard/messages" && unreadMessages > 0 && <span className="rounded-full bg-teal px-1.5 text-[11px] font-bold text-navy">{unreadMessages}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Desktop : panneau latéral */}
      <nav aria-label="Mon espace" className="hidden lg:block">
        <div className="sticky top-20 space-y-5">
          <Link
            href="/publier"
            className="btn-shine flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal to-cyan-400 text-sm font-bold text-navy shadow-md transition hover:-translate-y-px hover:shadow-lg"
          >
            <PlusCircle className="size-4" aria-hidden /> Publier un besoin
          </Link>
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-1.5 px-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase">{g.title}</p>
              <ul className="space-y-0.5">
                {g.links.map((l) => {
                  const on = isActive(l.href, l.exact);
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        aria-current={on ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition",
                          on ? "bg-navy text-white shadow-md" : "text-slate-600 hover:bg-white hover:text-navy hover:shadow-sm",
                        )}
                      >
                        {on && <span aria-hidden className="absolute top-2 bottom-2 -left-1 w-1 rounded-full bg-teal" />}
                        <span
                          className={cn(
                            "flex size-7 items-center justify-center rounded-lg transition",
                            on ? "bg-white/10 text-teal-300" : "bg-slate-100 text-slate-500 group-hover:bg-teal-50 group-hover:text-teal-700",
                          )}
                        >
                          <l.icon className="size-4" aria-hidden />
                        </span>
                        <span className="flex-1">{l.label}</span>
                        {l.href === "/dashboard/messages" && unreadMessages > 0 && (
                          <span className="animate-pulse rounded-full bg-teal px-1.5 text-[11px] font-bold text-navy">{unreadMessages}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}
