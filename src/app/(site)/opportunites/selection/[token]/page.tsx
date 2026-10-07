import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BellRing, CalendarClock, CheckCircle2, ExternalLink, FileText, MapPin, Tag } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createAdminClient } from "@/lib/supabase/admin";
import { clip, deadlineLabel, formatDate } from "@/lib/format";
import { isStillOpen, loadRecipientBundles, loadReferentials, outreachUrls } from "@/lib/outreach/data";
import { recipientFromToken, track } from "@/lib/outreach/tracking";
import { PRIVATE_METADATA } from "@/lib/seo";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { ...PRIVATE_METADATA, title: "Votre sélection d'opportunités" };

/**
 * Sélection personnalisée (LinkProB2B Outreach) : uniquement les opportunités
 * choisies pour ce destinataire, avec leur source. URL unique et signée,
 * non indexée.
 */
export default async function SelectionPage(props: PageProps<"/opportunites/selection/[token]">) {
  const { token } = await props.params;
  const r = await recipientFromToken(token);
  if (!r) notFound();
  const db = createAdminClient();
  const [bundle] = await loadRecipientBundles(db, [r.id]);
  if (!bundle) notFound();
  const h = await headers();
  // Aperçu depuis le tableau de bord (administrateur) : pas de statistique faussée.
  const preview = (await props.searchParams).apercu === "1" && Boolean((await getSession())?.isStaff);
  if (!preview && !h.get("next-router-prefetch") && h.get("purpose") !== "prefetch") await track(r, "LANDING_VIEW");

  const ref = await loadReferentials(db);
  const urls = outreachUrls(r.id);
  const all = bundle.opportunities.filter((o) => !o.excluded);
  const open = all.filter(isStillOpen);
  const closed = all.length - open.length;
  const n = open.length;

  return (
    <div className="bg-sky/40">
      <section className="border-b border-slate-200 bg-white">
        <div className="container-page py-10 sm:py-14">
          <p className="text-sm font-bold tracking-wide text-teal-700 uppercase">Sélection personnalisée · {formatDate(bundle.campaign.campaign_date)}</p>
          <h1 className="mt-2 text-3xl leading-tight font-bold sm:text-4xl">
            {n > 0 ? `${n} opportunité${n > 1 ? "s" : ""} correspondant à votre activité` : "Les opportunités de cette sélection sont clôturées"}
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-slate-600">
            Sélection préparée pour <strong className="text-navy">{bundle.prospect.name}</strong> à partir des opportunités publiées sur LinkProB2B, en fonction de
            votre activité et de votre localisation.
          </p>
          {closed > 0 && n > 0 && <p className="mt-2 text-sm text-slate-500">{closed} opportunité(s) de la sélection initiale sont clôturées depuis l&apos;envoi et ne sont plus affichées.</p>}
        </div>
      </section>

      <div className="container-page grid grid-cols-1 gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          {n === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-slate-700">De nouvelles opportunités sont publiées chaque jour sur LinkProB2B.</p>
              <Link href="/opportunites" className={buttonClasses({ className: "mt-4" })}>
                Voir les opportunités ouvertes
              </Link>
            </div>
          )}
          {open.map((o) => {
            const dl = deadlineLabel(o.response_deadline);
            const location = ref.location(o.city, o.department_code, o.region);
            return (
              <article key={o.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm [overflow-wrap:anywhere] sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  {o.sector_slug && <Badge tone="teal" icon={<Tag className="size-3" aria-hidden />}>{ref.sectorLabel(o.sector_slug)}</Badge>}
                  {dl && <Badge tone={dl.startsWith("Encore") || dl === "Dernier jour" ? "amber" : "slate"}>{dl}</Badge>}
                </div>
                <h2 className="mt-3 text-xl leading-snug font-bold">{o.title}</h2>
                {o.external_buyer_name && <p className="mt-1 text-sm text-slate-600">Acheteur : {o.external_buyer_name}</p>}
                <p className="mt-3 text-[15px] leading-7 text-slate-700">{clip((o.summary ?? o.description).replace(/\s+/g, " "), 420)}</p>
                <dl className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 shrink-0 text-teal-700" aria-hidden />
                    <dt className="sr-only">Localisation</dt>
                    <dd>{location ?? "Non précisée"}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-4 shrink-0 text-teal-700" aria-hidden />
                    <dt className="sr-only">Date limite</dt>
                    <dd>Date limite : {o.response_deadline ? formatDate(o.response_deadline) : "voir l'annonce"}</dd>
                  </div>
                  {o.source?.name && (
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <FileText className="size-4 shrink-0 text-teal-700" aria-hidden />
                      <dt className="sr-only">Source</dt>
                      <dd>
                        Source : {o.source.name}
                        {o.source.reference ? ` · réf. ${o.source.reference}` : ""}
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a href={urls.opportunity(o.id)} className={buttonClasses()}>
                    Voir l&apos;opportunité
                  </a>
                  {o.source?.url && (
                    <a href={`/go/${o.id}`} target="_blank" rel="noopener noreferrer nofollow" className={buttonClasses({ variant: "outline" })}>
                      Source officielle <ExternalLink className="size-4" aria-hidden />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
          <p className="text-xs text-slate-500">
            Les opportunités externes proviennent de sources publiques identifiées sur chaque annonce ; l&apos;avis officiel fait foi. LinkProB2B n&apos;est pas
            l&apos;organisme qui publie ces marchés.
          </p>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl bg-navy p-6 text-white">
            <BellRing className="size-7 text-teal" aria-hidden />
            <p className="mt-3 font-heading text-xl font-bold">Recevez automatiquement les prochaines opportunités</p>
            <p className="mt-2 text-sm text-slate-300">Vous souhaitez recevoir les opportunités correspondant à votre activité dès leur publication ?</p>
            <ul className="mt-4 space-y-2 text-sm">
              {["Appels d'offres et besoins d'entreprises partout en France", "Alertes par secteur et par zone", "Création de compte gratuite"].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            <Link href={`/inscription?ref=o.${token}`} className={buttonClasses({ full: true, size: "lg", className: "mt-5" })}>
              Créer mon compte gratuitement
            </Link>
            <Link href="/comment-ca-marche" className="mt-3 block text-center text-sm text-slate-300 underline">
              Comment fonctionne LinkProB2B ?
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            <p className="font-semibold text-navy">Pourquoi cette sélection ?</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {bundle.recipient.reasons.slice(0, 4).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Coordonnées de votre entreprise : {bundle.prospect.source}.{" "}
              <Link href={`/desinscription/${token}`} className="underline">
                Ne plus recevoir ces sélections
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
