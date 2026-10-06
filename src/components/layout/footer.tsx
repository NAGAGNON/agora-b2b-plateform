import Link from "next/link";
import { Logo } from "@/components/logo";
import { SLOGAN } from "@/lib/constants";

const COLUMNS = [
  {
    title: "Plateforme",
    links: [
      { href: "/opportunites", label: "Explorer les opportunités" },
      { href: "/publier", label: "Publier un besoin" },
      { href: "/entreprises", label: "Annuaire des entreprises" },
      { href: "/comment-ca-marche", label: "Comment ça marche" },
    ],
  },
  {
    title: "Pour vous",
    links: [
      { href: "/fournisseurs", label: "Pour les fournisseurs" },
      { href: "/demandeurs", label: "Pour les demandeurs" },
      { href: "/ressources", label: "Ressources et guides" },
      { href: "/faq", label: "Questions fréquentes" },
    ],
  },
  {
    title: "LinkProB2B",
    links: [
      { href: "/a-propos", label: "À propos" },
      { href: "/contact", label: "Contact" },
      { href: "/contact?objet=signalement", label: "Signaler un contenu" },
      { href: "/tarifs", label: "Tarifs" },
    ],
  },
  {
    title: "Informations légales",
    links: [
      { href: "/mentions-legales", label: "Mentions légales" },
      { href: "/cgu", label: "Conditions d'utilisation" },
      { href: "/confidentialite", label: "Confidentialité" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto bg-navy text-slate-300">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Logo variant="white" />
          <p className="mt-3 max-w-xs text-sm">{SLOGAN}</p>
          <p className="mt-4 text-xs text-slate-400">Pilote en cours en Bretagne — Finistère.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-sm font-bold text-white">{c.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-4 text-xs text-slate-400">© {new Date().getFullYear()} LinkProB2B. Version pilote.</p>
      </div>
    </footer>
  );
}
