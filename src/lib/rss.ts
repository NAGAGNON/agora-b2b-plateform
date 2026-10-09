/** Flux RSS 2.0 des opportunités ouvertes (lecteurs RSS, veilles, agrégateurs). */
export type RssItem = {
  id: string;
  title: string;
  summary: string | null;
  buyer: string | null;
  place: string | null;
  sector: string | null;
  deadline: string | null;
  publishedAt: string | null;
  source: string | null;
};

const xml = (s: string) =>
  s
    // Caractères interdits en XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const day = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

export function renderRss({ base, title, description, selfPath, items, now = new Date() }: { base: string; title: string; description: string; selfPath: string; items: RssItem[]; now?: Date }): string {
  const entries = items.map((o) => {
    const link = `${base}/opportunites/${o.id}`;
    const lines = [
      o.summary?.trim() || null,
      o.buyer ? `Acheteur : ${o.buyer}` : null,
      o.place ? `Lieu : ${o.place}` : null,
      o.sector ? `Secteur : ${o.sector}` : null,
      o.deadline ? `Date limite de réponse : ${day(o.deadline)}` : null,
      o.source ? `Source : ${o.source}` : null,
    ].filter(Boolean) as string[];
    return [
      "<item>",
      `<title>${xml(o.title)}</title>`,
      `<link>${xml(link)}</link>`,
      `<guid isPermaLink="true">${xml(link)}</guid>`,
      o.publishedAt ? `<pubDate>${new Date(o.publishedAt).toUTCString()}</pubDate>` : "",
      o.sector ? `<category>${xml(o.sector)}</category>` : "",
      `<description>${xml(lines.join("\n"))}</description>`,
      "</item>",
    ].join("");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    `<title>${xml(title)}</title>`,
    `<link>${xml(`${base}/opportunites`)}</link>`,
    `<atom:link href="${xml(`${base}${selfPath}`)}" rel="self" type="application/rss+xml"/>`,
    `<description>${xml(description)}</description>`,
    "<language>fr-FR</language>",
    `<lastBuildDate>${now.toUTCString()}</lastBuildDate>`,
    "<ttl>60</ttl>",
    ...entries,
    "</channel>",
    "</rss>",
  ].join("\n");
}
