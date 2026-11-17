import Link from "next/link";
import { CalendarClock, Landmark, Megaphone, ScrollText } from "lucide-react";
import { JsonLd, faqLd } from "@/components/json-ld";
import { createClient } from "@/lib/supabase/server";
import { showDemoData } from "@/lib/queries/platform";
import { regionBySlug } from "@/lib/geo";
import { buyerSlug } from "@/lib/buyer-slug";
import type { Landing } from "@/lib/landing";

const DAY = 86_400_000;

/**
 * Repères d'une page d'atterrissage (métier, département, région) tirés des offres ouvertes :
 * combien, combien se terminent bientôt, quels acheteurs publient le plus ; puis les questions
 * fréquentes, en mots simples. Rien n'est inventé : uniquement les données de la page.
 */
export async function LandingInsights({ landing }: { landing: Landing }) {
  const f = landing.fixed;
  // Spécialités (recherche par mots) : les repères suivraient mal la recherche plein texte
  if (typeof f.q === "string" || landing.kind === "france") return null;
  const supabase = await createClient();
  const demo = await showDemoData();
  const now = new Date();
  const scope = <Q extends { eq: (c: string, v: string | boolean) => Q }>(q: Q): Q => {
    let r = q;
    if (!demo) r = r.eq("is_demo", false);
    if (typeof f.secteur === "string") r = r.eq("sector_slug", f.secteur);
    if (typeof f.departement === "string") r = r.eq("department_code", f.departement);
    const region = typeof f.region === "string" ? regionBySlug(f.region) : null;
    if (region) r = r.eq("region", region.name);
    return r;
  };
  const open = () => supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "PUBLISHED").gt("response_deadline", now.toISOString());
  const [{ count: total }, { count: soon }, { count: needs }, { data: sample }] = await Promise.all([
    scope(open()),
    scope(open().lt("response_deadline", new Date(now.getTime() + 7 * DAY).toISOString())),
    scope(open().eq("origin", "INTERNAL")),
    scope(supabase.from("opportunities").select("external_buyer_name").eq("status", "PUBLISHED").eq("origin", "EXTERNAL").gt("response_deadline", now.toISOString()).limit(1000)),
  ]);
  if (!total || total < 3) return null;
  const counts = new Map<string, number>();
  for (const r of sample ?? []) if (r.external_buyer_name) counts.set(r.external_buyer_name, (counts.get(r.external_buyer_name) ?? 0) + 1);
  const buyers = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, n]) => ({ name, n, slug: buyerSlug(name) }));
  // « Opportunités — Maintenance industrielle » → « Maintenance industrielle »
  const label = landing.heading.replace(/^Opportunités (B2B )?(dans le département |en |— )?/, "");
  const faq = [
    {
      question: `Comment trouver les appels d'offres « ${label} » ?`,
      answer: `Cette page les rassemble, mis à jour chaque jour à partir des annonces officielles (BOAMP, TED) et des besoins publiés par les entreprises. Créez une alerte gratuite pour recevoir les nouveaux par e-mail.`,
    },
    {
      question: "Faut-il payer pour répondre à un marché public ?",
      answer: "Non. Le dossier se télécharge gratuitement sur le site de l'acheteur, et l'offre s'y dépose. Sur LinkProB2B, le compte est gratuit.",
    },
    {
      question: "Je n'ai jamais répondu : par où commencer ?",
      answer: "Ouvrez une offre puis « En savoir plus » : les conditions, les pièces à fournir et la date limite sont expliquées simplement, avec les étapes une par une jusqu'au dépôt sur le site de l'acheteur.",
    },
    {
      question: "Il me manque une qualification ou une certification : que faire ?",
      answer: "Vous pouvez répondre avec une autre entreprise (groupement) ou lui confier une partie du travail (sous-traitance). Trouvez un partenaire dans l'annuaire ou parmi les entreprises disponibles.",
    },
  ];
  return (
    <section aria-labelledby="reperes" className="mt-12 grid gap-6 lg:grid-cols-2" data-testid="landing-insights">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <h2 id="reperes" className="font-heading text-xl font-bold text-navy">
          Repères : {label}
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { icon: ScrollText, n: total, l: total > 1 ? "offres ouvertes" : "offre ouverte" },
            { icon: CalendarClock, n: soon ?? 0, l: "se terminent dans les 7 jours" },
            { icon: Megaphone, n: needs ?? 0, l: (needs ?? 0) > 1 ? "besoins publiés par des entreprises" : "besoin publié par une entreprise" },
          ].map(({ icon: Icon, n, l }) => (
            <li key={l} className="rounded-2xl bg-sky/60 p-4">
              <Icon className="size-5 text-teal-700" aria-hidden />
              <p className="mt-2 font-heading text-2xl font-extrabold text-navy tabular-nums">{n.toLocaleString("fr-FR")}</p>
              <p className="text-sm text-slate-600">{l}</p>
            </li>
          ))}
        </ul>
        {buyers.length > 0 && (
          <>
            <h3 className="mt-6 flex items-center gap-2 font-bold text-navy">
              <Landmark className="size-4 text-teal-700" aria-hidden /> Les acheteurs qui publient le plus ici
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              {buyers.map((b) => (
                <li key={b.name} className="flex items-baseline justify-between gap-3">
                  {b.slug ? (
                    <Link href={`/acheteurs/${b.slug}`} className="min-w-0 truncate font-semibold text-teal-800 hover:underline">
                      {b.name}
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate font-semibold text-navy">{b.name}</span>
                  )}
                  <span className="shrink-0 text-slate-500 tabular-nums">
                    {b.n} offre{b.n > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <h2 className="font-heading text-xl font-bold text-navy">Questions fréquentes</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {faq.map((q) => (
            <details key={q.question} className="group py-3">
              <summary className="cursor-pointer list-none font-semibold text-navy [&::-webkit-details-marker]:hidden">
                <span className="mr-2 inline-block text-teal-700 transition group-open:rotate-90" aria-hidden>
                  ›
                </span>
                {q.question}
              </summary>
              <p className="mt-2 pl-5 text-sm leading-relaxed text-slate-600">{q.answer}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-sm">
          <Link href="/disponibilites" className="font-semibold text-teal-700 underline">
            Voir les entreprises disponibles
          </Link>
        </p>
      </div>
      <JsonLd data={faqLd(faq)} />
    </section>
  );
}
