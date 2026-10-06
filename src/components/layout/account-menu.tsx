"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings, Shield } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { initials } from "@/lib/format";

export function AccountMenu({
  name,
  email,
  company,
  isStaff,
  links,
}: {
  name: string;
  email: string;
  company: string | null;
  isStaff: boolean;
  links: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const item = "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-navy hover:bg-sky";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-1.5 hover:bg-sky"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{initials(name)}</span>
        <span className="max-w-36 truncate text-sm font-semibold text-navy">{name}</span>
        <ChevronDown className="size-4 text-slate-500" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="border-b border-slate-100 px-3 pt-1 pb-3">
            <p className="truncate text-sm font-semibold text-navy">{name}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
            {company && <p className="mt-1 truncate text-xs font-medium text-teal-700">{company}</p>}
          </div>
          <div className="py-1">
            {links.map((l) => (
              <Link key={l.href} href={l.href} role="menuitem" className={item} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <Link href="/dashboard/parametres" role="menuitem" className={item} onClick={() => setOpen(false)}>
              <Settings className="size-4" aria-hidden /> Paramètres
            </Link>
            {isStaff && (
              <Link href="/admin" role="menuitem" className={item} onClick={() => setOpen(false)}>
                <Shield className="size-4" aria-hidden /> Administration
              </Link>
            )}
          </div>
          <form action={signOut} className="border-t border-slate-100 pt-1">
            <button type="submit" role="menuitem" className={`${item} w-full text-red-700`}>
              <LogOut className="size-4" aria-hidden /> Se déconnecter
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
