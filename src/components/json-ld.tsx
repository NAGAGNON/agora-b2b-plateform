import { ARTICLE_AUTHOR, siteUrl } from "@/lib/seo";

/**
 * Données structurées schema.org (JSON-LD) : invisibles pour l'utilisateur, lues par
 * les moteurs de recherche. « < » est échappé pour empêcher toute sortie du bloc script.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${base}${it.path}` })),
  };
}

export function organizationLd() {
  const base = siteUrl();
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${base}/#organisation`,
      name: "LinkProB2B",
      url: base,
      logo: `${base}/brand/logo.png`,
      description: "Plateforme B2B qui met en relation les entreprises qui ont un besoin avec celles capables d'y répondre, et recense les marchés publics.",
      areaServed: { "@type": "Country", name: "France" },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${base}/#site`,
      name: "LinkProB2B",
      url: base,
      inLanguage: "fr-FR",
      publisher: { "@id": `${base}/#organisation` },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${base}/opportunites?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

export function faqLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

export function articleLd(a: { title: string; description: string; path: string; publishedAt?: string | null; updatedAt?: string | null }) {
  const base = siteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    mainEntityOfPage: `${base}${a.path}`,
    ...(a.publishedAt ? { datePublished: a.publishedAt } : {}),
    ...(a.updatedAt ? { dateModified: a.updatedAt } : {}),
    inLanguage: "fr-FR",
    author: { "@type": "Person", name: ARTICLE_AUTHOR },
    publisher: { "@id": `${base}/#organisation` },
    image: `${base}/brand/logo.png`,
  };
}
