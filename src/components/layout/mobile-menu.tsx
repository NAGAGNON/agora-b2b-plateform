"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, LogOut, Shield } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { buttonClasses } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";

type L = { href: string; label: string };

/** Menu burger mobile / tablette. */
export function MobileMenu({
  signedIn,
  isStaff,
  name,
  publicLinks,
  accountLinks,
}: {
  signedIn: boolean;
  isStaff: boolean;
  name: string | null;
  publicLinks: L[];
  accountLinks: L[];
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const item = "block rounded-lg px-3 py-3 text-base font-semibold text-navy hover:bg-sky";
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-navy hover:bg-sky" aria-label="Ouvrir le menu" aria-expanded={open}>
        <Menu className="size-6" aria-hidden />
      </button>
      <Drawer open={open} onClose={close} title="Menu">
        {signedIn && name && <p className="mb-3 px-3 text-sm text-slate-500">Connecté : {name}</p>}
        <nav aria-label="Navigation mobile" className="space-y-1">
          {publicLinks.map((l) => (
            <Link key={l.href} href={l.href} onClick={close} className={item}>
              {l.label}
            </Link>
          ))}
          <Link href="/comment-ca-marche" onClick={close} className={item}>
            Comment ça marche
          </Link>
        </nav>
        <hr className="my-4 border-slate-200" />
        {signedIn ? (
          <nav aria-label="Mon espace" className="space-y-1">
            {accountLinks.map((l) => (
              <Link key={l.href} href={l.href} onClick={close} className={item}>
                {l.label}
              </Link>
            ))}
            <Link href="/dashboard/parametres" onClick={close} className={item}>
              Paramètres
            </Link>
            {isStaff && (
              <Link href="/admin" onClick={close} className={`${item} flex items-center gap-2`}>
                <Shield className="size-4" aria-hidden /> Administration
              </Link>
            )}
            <form action={signOut}>
              <button type="submit" className={`${item} flex w-full items-center gap-2 text-left text-red-700`}>
                <LogOut className="size-4" aria-hidden /> Se déconnecter
              </button>
            </form>
          </nav>
        ) : (
          <div className="space-y-2">
            <Link href="/inscription" onClick={close} className={buttonClasses({ full: true, size: "lg" })}>
              Créer un compte
            </Link>
            <Link href="/connexion" onClick={close} className={buttonClasses({ full: true, size: "lg", variant: "outline" })}>
              Connexion
            </Link>
          </div>
        )}
      </Drawer>
    </div>
  );
}
