import { escapeHtml } from "@/lib/email/escape";
import { button, callout, cards as cardList, heroUrl, note, noteLink, paragraph, sectorBannerUrl, sectorThumbUrl, shell } from "@/lib/email/design";
import type { VeilleOpportunity, CriteriaBasis } from "@/lib/veille/select";

export type VeilleKind = "LAUNCH" | "MONDAY" | "FRIDAY" | "DAILY";

export type VeilleEmailInput = {
  kind: VeilleKind;
  base: string;
  /** Jeton de l'envoi (suivi des clics, désinscription) ; « apercu » pour un aperçu ou un test */
  token: string;
  firstName: string | null;
  items: VeilleOpportunity[];
  basis: CriteriaBasis;
  frequency: string;
  sectorLabel: (slug: string) => string;
  typeLabel: (type: string) => string;
};

const dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" });
export const day = (iso: string) => dateFmt.format(new Date(iso));
export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function veilleSubject(kind: VeilleKind, count: number): string {
  if (kind === "LAUNCH") return "Votre veille B2B LinkProB2B — une première sélection d'opportunités ouvertes";
  if (kind === "MONDAY") return "Votre veille B2B — les nouvelles opportunités de la semaine";
  if (kind === "FRIDAY") return "Votre veille B2B — la sélection du vendredi";
  return count > 1 ? `Vos opportunités du jour — ${count} correspondent à vos critères` : "Votre opportunité du jour correspond à vos critères";
}

export const veilleLinks = (base: string, token: string) => ({
  item: (id: string) => `${base}/api/veille/c?t=${encodeURIComponent(token)}&o=${id}`,
  all: `${base}/api/veille/c?t=${encodeURIComponent(token)}&p=opportunites`,
  daily: `${base}/api/veille/c?t=${encodeURIComponent(token)}&p=quotidien`,
  prefs: `${base}/api/veille/c?t=${encodeURIComponent(token)}&p=preferences`,
  unsubscribe: `${base}/veille/desabonnement?jeton=${encodeURIComponent(token)}`,
  pixel: `${base}/api/veille/o?t=${encodeURIComponent(token)}`,
});

function intro(i: VeilleEmailInput): string[] {
  const hello = i.firstName ? `Bonjour ${i.firstName},` : "Bonjour,";
  const why =
    i.basis === "preferences"
      ? "Cette sélection a été établie à partir des critères que vous avez enregistrés dans vos préférences de veille."
      : i.basis === "entreprise"
        ? "Cette sélection a été établie à partir des secteurs et de la région renseignés pour votre entreprise. Précisez vos critères pour l'affiner."
        : "Vous n'avez pas encore indiqué vos critères : voici une sélection variée d'opportunités récentes. Indiquez vos secteurs et vos régions pour recevoir une sélection adaptée.";
  if (i.kind === "LAUNCH")
    return [
      hello,
      "LinkProB2B rassemble chaque jour les marchés publics (BOAMP, TED) et les besoins publiés par des entreprises, partout en France, pour que vous trouviez plus vite les opportunités qui vous concernent.",
      "Nous lançons aujourd'hui la veille par e-mail : une sélection d'opportunités ouvertes, vérifiées avant l'envoi, avec un lien vers la fiche détaillée et la source officielle.",
      why,
    ];
  if (i.kind === "DAILY") return [hello, "Voici les nouvelles opportunités qui correspondent à vos critères depuis votre dernière alerte.", why];
  return [hello, i.kind === "MONDAY" ? "Voici une sélection des nouvelles opportunités B2B publiées cette semaine et encore ouvertes." : "Voici une sélection actualisée des dernières opportunités B2B encore ouvertes.", why];
}

function meta(o: VeilleOpportunity, i: Pick<VeilleEmailInput, "sectorLabel">): string[] {
  return [
    o.sector_slug ? i.sectorLabel(o.sector_slug) : null,
    [o.city, o.department_code ? `(${o.department_code})` : null].filter(Boolean).join(" ") || o.region,
    o.published_at ? `Publiée le ${day(o.published_at)}` : null,
  ].filter((x): x is string => Boolean(x));
}

/** Cartes d'opportunités (HTML) : vignette du secteur, type, titre, acheteur, résumé, lieu, date limite, source. */
export function renderCards(items: VeilleOpportunity[], link: (id: string) => string, i: Pick<VeilleEmailInput, "sectorLabel" | "typeLabel"> & { base?: string }): string {
  return cardList(
    items.map((o) => {
      const desc = o.summary ?? o.description;
      return {
        kicker: i.typeLabel(o.type),
        title: clip(o.title, 140),
        url: link(o.id),
        subtitle: o.origin === "EXTERNAL" ? o.external_buyer_name : null,
        summary: desc ? clip(desc.replace(/\s+/g, " ").trim(), 220) : null,
        meta: [...meta(o, i), o.origin === "EXTERNAL" ? `Source : ${o.source}` : "Publiée sur LinkProB2B"],
        deadline: o.response_deadline ? day(o.response_deadline) : null,
        image: i.base ? sectorThumbUrl(i.base, o.sector_slug) : null,
      };
    }),
  );
}

/** E-mail de veille (HTML adapté au mobile + version texte). Aucune donnée inventée : uniquement les champs présents. */
export function renderVeilleEmail(i: VeilleEmailInput): { subject: string; html: string; text: string } {
  const L = veilleLinks(i.base, i.token);
  const subject = veilleSubject(i.kind, i.items.length);
  const paragraphs = intro(i);
  const top = new Map<string, number>();
  for (const o of i.items) if (o.sector_slug) top.set(o.sector_slug, (top.get(o.sector_slug) ?? 0) + 1);
  const mainSector = [...top.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
  const reason =
    i.frequency === "DAILY"
      ? "Vous recevez cet e-mail car vous avez activé les alertes quotidiennes de LinkProB2B."
      : "Vous recevez cet e-mail car vous avez un compte LinkProB2B et avez accepté de recevoir ses actualités ou sa veille par e-mail.";
  const html = shell({
    base: i.base,
    subject,
    preheader: i.items.length ? clip(i.items[0].title, 90) : "Votre veille B2B",
    kicker: i.kind === "DAILY" ? "Alerte quotidienne" : "Veille commerciale",
    title: subject.replace(/^Votre veille B2B( LinkProB2B)? — /, ""),
    heroImage: i.kind === "LAUNCH" || !mainSector ? heroUrl(i.base, "meridiens") : sectorBannerUrl(i.base, mainSector),
    body:
      paragraphs.map(paragraph).join("") +
      renderCards(i.items, L.item, i) +
      button("Voir toutes les opportunités ouvertes", L.all, { align: "center" }) +
      (i.frequency !== "DAILY"
        ? callout({
            kicker: "Alerte quotidienne",
            title: "Et si les opportunités venaient directement à vous ?",
            text: "Recevez chaque jour une sélection d'opportunités B2B adaptée à votre entreprise, à votre secteur d'activité et à votre zone géographique. Vous préférez une veille moins fréquente ? Gardez deux sélections par semaine, le lundi et le vendredi.",
            cta: { label: "Recevoir mes opportunités chaque jour", url: L.daily },
          })
        : ""),
    notes:
      note(`${escapeHtml(reason)} Chaque annonce est vérifiée (toujours ouverte) au moment de l'envoi ; consultez la source officielle avant de répondre.`) +
      note(`${noteLink("Gérer mes préférences", L.prefs)} · ${noteLink("Se désabonner", L.unsubscribe)}`),
    pixelUrl: i.token !== "apercu" ? L.pixel : null,
  });
  const text = [
    subject,
    "",
    ...paragraphs,
    "",
    ...i.items.flatMap((o) => [
      `• ${o.title}`,
      ...(o.origin === "EXTERNAL" && o.external_buyer_name ? [`  ${o.external_buyer_name}`] : []),
      ...(meta(o, i).length ? [`  ${meta(o, i).join(" · ")}`] : []),
      ...(o.response_deadline ? [`  Réponse avant le ${day(o.response_deadline)}`] : []),
      `  ${o.origin === "EXTERNAL" ? `Source : ${o.source}` : "Publiée sur LinkProB2B"}`,
      `  ${L.item(o.id)}`,
      "",
    ]),
    `Toutes les opportunités ouvertes : ${L.all}`,
    ...(i.frequency !== "DAILY" ? ["", "Recevoir mes opportunités chaque jour : " + L.daily, "Vous préférez une veille moins fréquente ? Recevez deux sélections par semaine, le lundi et le vendredi."] : []),
    "",
    reason,
    `Gérer mes préférences : ${L.prefs}`,
    `Se désabonner : ${L.unsubscribe}`,
    "LinkProB2B — www.linkprob2b.com",
  ].join("\n");
  return { subject, html, text };
}

/**
 * Invitation unique à activer la veille (inscrits sans accord) : explique pourquoi ce message,
 * montre quelques opportunités réelles, un bouton pour activer, et rien d'autre ne suit sans accord.
 */
export function renderVeilleInvitation(i: { base: string; token: string; firstName: string | null; items: VeilleOpportunity[]; personalized: boolean; sectorLabel: (slug: string) => string }) {
  const L = veilleLinks(i.base, i.token);
  const subject = "Activez votre veille B2B gratuite sur LinkProB2B";
  const paragraphs = [
    i.firstName ? `Bonjour ${i.firstName},` : "Bonjour,",
    "Vous avez créé un compte sur LinkProB2B. Nous proposons désormais une veille gratuite par e-mail : une sélection d'opportunités B2B réelles et encore ouvertes (marchés publics BOAMP et TED, besoins d'entreprises), le lundi et le vendredi, ou chaque jour si vous le préférez.",
    i.personalized
      ? "Voici quelques opportunités publiées récemment qui correspondent aux secteurs de votre entreprise :"
      : "Voici quelques opportunités publiées récemment :",
  ];
  const html = shell({
    base: i.base,
    subject,
    preheader: "Une sélection gratuite d'opportunités B2B réelles et encore ouvertes, à votre rythme.",
    kicker: "Veille gratuite",
    title: "Activez votre veille B2B gratuite",
    heroImage: heroUrl(i.base, "meridiens"),
    body:
      paragraphs.map(paragraph).join("") +
      cardList(
        i.items.map((o) => ({
          title: clip(o.title, 140),
          url: L.item(o.id),
          subtitle: o.origin === "EXTERNAL" ? o.external_buyer_name : null,
          meta: [o.sector_slug ? i.sectorLabel(o.sector_slug) : null, o.region].filter((x): x is string => Boolean(x)),
          deadline: o.response_deadline ? day(o.response_deadline) : null,
          image: sectorThumbUrl(i.base, o.sector_slug),
        })),
      ) +
      button("Activer ma veille", L.prefs, { align: "center" }) +
      `<p style="margin:0 0 20px;text-align:center;font-size:13px;color:#475569">Vous choisissez vos secteurs, vos régions et la fréquence. Gratuit, sans engagement.</p>`,
    notes:
      note("Vous recevez ce message unique parce que vous avez un compte LinkProB2B. Sans action de votre part, vous ne recevrez pas la veille et nous ne vous écrirons plus à ce sujet.") +
      note(noteLink("Ne plus recevoir ce type d'e-mail", L.unsubscribe)),
    pixelUrl: L.pixel,
  });
  const text = [
    subject,
    "",
    ...paragraphs,
    "",
    ...i.items.flatMap((o) => [`• ${o.title}`, `  ${L.item(o.id)}`]),
    "",
    `Activer ma veille : ${L.prefs}`,
    "Vous choisissez vos secteurs, vos régions et la fréquence. Gratuit, sans engagement.",
    "",
    "Vous recevez ce message unique parce que vous avez un compte LinkProB2B. Sans action de votre part, vous ne recevrez pas la veille et nous ne vous écrirons plus à ce sujet.",
    `Ne plus recevoir ce type d'e-mail : ${L.unsubscribe}`,
  ].join("\n");
  return { subject, html, text };
}
