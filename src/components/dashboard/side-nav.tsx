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
} from "lucide-react";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/dashboard", label: "Tableau de bord", icon: Home, exact: true },
  { href: "/dashboard/opportunites", label: "Opportunités", icon: FileStack },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/dashboard/favoris", label: "Favoris", icon: Heart },
  { href: "/dashboard/alertes", label: "Alertes", icon: BellRing },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/profil", label: "Profil", icon: User },
  { href: "/dashboard/entreprise", label: "Entreprise", icon: Building2 },
  { href: "/dashboard/parametres", label: "Paramètres", icon: Settings },
];

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
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap",
                  isActive(l.href, l.exact) ? "bg-navy text-white" : "text-slate-600 hover:bg-sky",
                )}
              >
                <l.icon className="size-4" aria-hidden />
                {l.label}
                {l.href === "/dashboard/messages" && unreadMessages > 0 && <span className="rounded-full bg-teal px-1.5 text-[11px] text-white">{unreadMessages}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Desktop : panneau latéral */}
      <nav aria-label="Mon espace" className="hidden lg:block">
        <Link href="/publier" className="mb-4 flex h-11 items-center justify-center gap-2 rounded-lg bg-teal text-sm font-semibold text-white hover:bg-teal-600">
          <PlusCircle className="size-4" aria-hidden /> Publier un besoin
        </Link>
        <ul className="space-y-0.5">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={isActive(l.href, l.exact) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold",
                  isActive(l.href, l.exact) ? "bg-navy text-white" : "text-slate-600 hover:bg-sky hover:text-navy",
                )}
              >
                <l.icon className="size-4" aria-hidden />
                <span className="flex-1">{l.label}</span>
                {l.href === "/dashboard/messages" && unreadMessages > 0 && <span className="rounded-full bg-teal px-1.5 text-[11px] text-white">{unreadMessages}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
