import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { Notice } from "@/components/ui/notice";
import { LEGAL, legalIncomplete } from "@/lib/legal";

export type LegalSection = { id: string; title: string; content: ReactNode };

const LEGAL_LINKS = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgu", label: "CGU" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/cookies", label: "Cookies" },
  { href: "/conditions-abonnement", label: "Conditions d'abonnement" },
];

/** Page juridique : sommaire, titres numérotés avec ancres, retour en haut, liens entre documents. */
export function LegalPage({ title, intro, sections, current }: { title: string; intro?: ReactNode; sections: LegalSection[]; current: string }) {
  return (
    <div className="container-page max-w-3xl py-10 sm:py-14" id="haut">
      <nav aria-label="Documents légaux" className="mb-6 flex flex-wrap gap-2 text-sm">
        {LEGAL_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={l.href === current ? "page" : undefined}
            className={l.href === current ? "rounded-full bg-navy px-3 py-1 font-semibold text-white" : "rounded-full bg-sky px-3 py-1 text-navy hover:bg-sky-200"}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : {LEGAL.lastUpdated}</p>
      {intro && <div className="mt-4 text-[15px] text-slate-700">{intro}</div>}
      {legalIncomplete() && (
        <Notice tone="warning" className="mt-6" title="Document en cours de finalisation">
          Les mentions signalées « [À COMPLÉTER] » seront renseignées avant le lancement commercial. Ce document doit être relu et validé par un professionnel
          du droit.
        </Notice>
      )}
      <nav aria-labelledby="sommaire" className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 id="sommaire" className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Sommaire
        </h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-navy hover:text-teal-700 hover:underline">
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="prose-content mt-8 text-[15px] text-slate-700">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titre`} className="scroll-mt-24">
            <h2 id={`${s.id}-titre`}>
              {i + 1}. {s.title}
            </h2>
            {s.content}
          </section>
        ))}
      </div>
      <p className="mt-10 border-t border-slate-200 pt-4 text-sm">
        <a href="#haut" className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline">
          <ArrowUp className="size-4" aria-hidden /> Retour en haut
        </a>
      </p>
    </div>
  );
}

/** Mention à compléter, mise en évidence. */
export function Todo({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-amber-100 px-1 text-amber-900">{children}</mark>;
}
