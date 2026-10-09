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
      { href: "/analyses", label: "Analyses des marchés" },
      { href: "/acheteurs", label: "Acheteurs publics" },
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
      { href: "/cgu", label: "Conditions générales d'utilisation" },
      { href: "/confidentialite", label: "Politique de confidentialité" },
      { href: "/cookies", label: "Politique cookies" },
      { href: "/conditions-abonnement", label: "Conditions d'abonnement" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto bg-navy text-slate-300">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Logo variant="white" />
          <p className="mt-3 max-w-xs text-sm">{SLOGAN}</p>
          <p className="mt-4 text-xs text-slate-400">La plateforme B2B française.</p>
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
        <div className="container-page flex flex-col gap-2 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} LinkProB2B.</p>
          <nav aria-label="Liens légaux" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/mentions-legales" className="hover:text-white hover:underline">Mentions légales</Link>
            <Link href="/cgu" className="hover:text-white hover:underline">CGU</Link>
            <Link href="/confidentialite" className="hover:text-white hover:underline">Confidentialité</Link>
            <Link href="/cookies" className="hover:text-white hover:underline">Cookies</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
