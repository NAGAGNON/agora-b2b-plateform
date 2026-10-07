import Link from "next/link";
import { BookOpen } from "lucide-react";
import { GUIDES } from "@/content/guides";
import { Badge } from "@/components/ui/badge";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Ressources et guides",
  description: "Guides pratiques pour rédiger un cahier des charges, choisir un prestataire, répondre à une consultation et lire les opportunités externes.",
  path: "/ressources",
});

export default function ResourcesPage() {
  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">Ressources</h1>
      <p className="mt-3 max-w-2xl text-lg text-slate-600">Guides pratiques pour mieux acheter et mieux répondre en B2B. De nouveaux contenus seront ajoutés au fil du pilote, à partir de vos questions.</p>
      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link href={`/ressources/${g.slug}`} className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal hover:shadow-md">
              <div className="flex items-center gap-2">
                <BookOpen className="size-5 text-teal-600" aria-hidden />
                <Badge tone="sky">{g.audience}</Badge>
              </div>
              <h2 className="mt-3 text-xl font-bold group-hover:text-teal-700">{g.title}</h2>
              <p className="mt-2 text-slate-600">{g.description}</p>
              <span className="mt-auto pt-4 text-sm font-semibold text-teal-700">Lire le guide →</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/analyses", t: "Analyses des marchés", d: "Marchés publics et besoins par secteur et par département, chaque mois." },
          { href: "/comment-ca-marche", t: "Comment ça marche", d: "Le fonctionnement de la plateforme en détail." },
          { href: "/faq", t: "Questions fréquentes", d: "Provenance, modération, tarifs, données." },
          { href: "/contact", t: "Une question ?", d: "Écrivez-nous, nous enrichirons ces ressources." },
        ].map((x) => (
          <Link key={x.href} href={x.href} className="rounded-2xl bg-sky p-5 hover:bg-sky/70">
            <p className="font-semibold text-navy">{x.t}</p>
            <p className="text-sm text-slate-600">{x.d}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
