import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { pageMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/format";
import { ContentPage } from "@/components/content-page";
import { JsonLd, articleLd, breadcrumbLd, faqLd } from "@/components/json-ld";
import Image from "next/image";
import type { ArticleBody } from "@/lib/articles";
import { articleFigures, type ArticleFacts } from "@/lib/article-figures";
import { BarChart, KeyFigures } from "@/components/article-charts";
import { ARTICLE_AUTHOR } from "@/lib/seo";

export const revalidate = 3600;

type Facts = ArticleFacts;

const getArticle = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("articles")
    .select(
      "slug, title, description, body, facts, status, published_at, updated_at",
    )
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

export async function generateMetadata(props: PageProps<"/analyses/[slug]">) {
  const { slug } = await props.params;
  const a = await getArticle(slug);
  if (!a) return { title: "Analyse introuvable" };
  const meta = pageMetadata({
    title: a.title,
    description: a.description,
    path: `/analyses/${a.slug}`,
    noindex: a.status !== "PUBLISHED",
  });
  const image = {
    url: `/visuels/analyses/${a.slug}`,
    width: 1200,
    height: 630,
    alt: a.title,
  };
  return {
    ...meta,
    openGraph: { ...meta.openGraph, type: "article", images: [image] },
    twitter: { card: "summary_large_image", images: [image.url] },
  };
}

/** Chemin interne pour un lien absolu du site (les liens restent sur le domaine courant). */
function internal(href: string) {
  try {
    const u = new URL(href);
    return u.pathname + u.search;
  } catch {
    return href;
  }
}

export default async function AnalysePage(
  props: PageProps<"/analyses/[slug]">,
) {
  const { slug } = await props.params;
  const a = await getArticle(slug);
  if (!a) notFound();
  const body = a.body as unknown as ArticleBody;
  const facts = a.facts as unknown as Facts;
  const path = `/analyses/${a.slug}`;
  const fig = articleFigures(facts);
  const charts = (
    <>
      <BarChart title={fig.breakdownTitle} data={fig.breakdown} />
      <BarChart
        title="Principaux acheteurs publics"
        data={fig.buyers}
        unit="consultations"
      />
    </>
  );
  return (
    <ContentPage
      title={a.title}
      intro={body.intro}
      updated={a.published_at ? formatDate(a.published_at) : undefined}
    >
      <JsonLd
        data={[
          articleLd({
            title: a.title,
            description: a.description,
            path,
            publishedAt: a.published_at,
            updatedAt: a.updated_at,
          }),
          breadcrumbLd([
            { name: "Analyses des marchés", path: "/analyses" },
            { name: a.title, path },
          ]),
          ...(body.faq?.length ? [faqLd(body.faq)] : []),
        ]}
      />
      {a.status !== "PUBLISHED" && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Brouillon : visible uniquement par l&apos;équipe.
        </p>
      )}
      {a.status === "PUBLISHED" && (
        <Image
          src={`/visuels/analyses/${a.slug}`}
          alt={`${a.title} — ${fig.total} opportunités ouvertes`}
          width={1200}
          height={630}
          unoptimized
          priority
          className="mb-6 h-auto w-full rounded-2xl shadow-sm"
        />
      )}
      {/* La couverture porte déjà les chiffres clés ; ils restent affichés en texte pour les brouillons. */}
      {a.status !== "PUBLISHED" && (
        <KeyFigures
          items={[
            { label: "opportunités ouvertes", value: fig.total },
            ...(fig.within30
              ? [
                  {
                    label: "avec une date limite sous 30 jours",
                    value: fig.within30,
                  },
                ]
              : []),
            ...(fig.publicTenders
              ? [
                  {
                    label: "marchés publics (BOAMP, TED)",
                    value: fig.publicTenders,
                  },
                ]
              : []),
          ]}
        />
      )}
      {body.sections.map((s, i) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          {s.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {i === 0 && charts}
        </section>
      ))}

      {facts.prochaines_dates_limites &&
        facts.prochaines_dates_limites.length > 0 && (
          <section>
            <h2>Opportunités ouvertes, par date limite</h2>
            <ul>
              {facts.prochaines_dates_limites.map((o) => (
                <li key={o.lien}>
                  <Link href={internal(o.lien)}>{o.intitule}</Link>
                  {[o.acheteur, o.ville].filter(Boolean).length > 0 &&
                    ` — ${[o.acheteur, o.ville].filter(Boolean).join(", ")}`}{" "}
                  · date limite : {o.date_limite}
                </li>
              ))}
            </ul>
            {facts.page_de_la_plateforme && (
              <p>
                <Link href={internal(facts.page_de_la_plateforme)}>
                  Voir toutes les opportunités correspondantes et créer une
                  alerte →
                </Link>
              </p>
            )}
          </section>
        )}

      {body.faq?.length > 0 && (
        <section>
          <h2>Questions fréquentes</h2>
          {body.faq.map((f) => (
            <div key={f.question}>
              <h3>{f.question}</h3>
              <p>{f.answer}</p>
            </div>
          ))}
        </section>
      )}

      <p className="mt-10 border-t border-slate-200 pt-4 text-sm text-slate-500">
        Rédigé par <strong className="text-navy">{ARTICLE_AUTHOR}</strong>
        {facts.date_des_donnees ? `, d'après les données publiées sur LinkProB2B au ${facts.date_des_donnees}` : ""}. Sources :{" "}
        {facts.sources ?? "BOAMP et TED"} Vérifiez toujours les conditions sur l&apos;avis officiel avant de répondre.
      </p>
      <p>
        <Link href="/analyses">← Toutes les analyses</Link>
      </p>
    </ContentPage>
  );
}
