"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ban, Building2, FileStack, LayoutDashboard, Megaphone, Settings } from "lucide-react";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/outreach", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { href: "/outreach/campagnes", label: "Campagnes", icon: Megaphone },
  { href: "/outreach/opportunites", label: "Opportunités", icon: FileStack },
  { href: "/outreach/prospects", label: "Entreprises", icon: Building2 },
  { href: "/outreach/exclusions", label: "Ne plus contacter", icon: Ban },
  { href: "/outreach/parametres", label: "Paramètres", icon: Settings },
];

export function OutreachNav() {
  const pathname = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));
  return (
    <nav aria-label="LinkProB2B Outreach">
      <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-1 lg:overflow-visible">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active(l.href, l.exact) ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
                active(l.href, l.exact) ? "bg-white/12 text-white ring-1 ring-white/15" : "text-slate-300 hover:bg-white/8 hover:text-white",
              )}
            >
              <l.icon className={cn("size-4", active(l.href, l.exact) ? "text-teal" : "")} aria-hidden />
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
