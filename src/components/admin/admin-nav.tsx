"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, ClipboardCheck, FileStack, Flag, History, Settings, Users, Database, RefreshCw, Tags, Inbox, Mail, Newspaper, Megaphone } from "lucide-react";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/admin", label: "Vue d'ensemble", icon: BarChart3, exact: true },
  { href: "/admin/moderation", label: "Modération", icon: ClipboardCheck, badge: "pending" },
  { href: "/admin/opportunites", label: "Opportunités", icon: FileStack },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users, admin: true },
  { href: "/admin/entreprises", label: "Entreprises", icon: Building2 },
  { href: "/admin/signalements", label: "Signalements", icon: Flag, badge: "reports" },
  { href: "/admin/sources", label: "Sources externes", icon: Database, admin: true },
  { href: "/admin/synchronisations", label: "Synchronisations", icon: RefreshCw },
  { href: "/admin/reponses", label: "Intérêts et réponses", icon: Inbox },
  { href: "/admin/referentiels", label: "Secteurs et zones", icon: Tags, admin: true },
  { href: "/admin/articles", label: "Articles", icon: Newspaper, admin: true },
  { href: "/admin/emails", label: "E-mails", icon: Mail, admin: true },
  { href: "/admin/audit", label: "Journal d'audit", icon: History, admin: true },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings, admin: true },
  { href: "/outreach", label: "Outreach (prospection)", icon: Megaphone, admin: true },
];

export function AdminNav({ isAdmin, pending, reports }: { isAdmin: boolean; pending: number; reports: number }) {
  const pathname = usePathname();
  const links = LINKS.filter((l) => !l.admin || isAdmin);
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));
  const count = (b?: string) => (b === "pending" ? pending : b === "reports" ? reports : 0);
  return (
    <nav aria-label="Administration">
      <ul className="relative -mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active(l.href, l.exact) ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold whitespace-nowrap",
                active(l.href, l.exact) ? "bg-navy text-white" : "text-slate-600 hover:bg-sky hover:text-navy",
              )}
            >
              <l.icon className="size-4" aria-hidden />
              <span className="flex-1">{l.label}</span>
              {count(l.badge) > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[11px] text-navy">{count(l.badge)}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
