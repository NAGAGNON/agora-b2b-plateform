import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { parisDayStart, parisToday } from "@/lib/daily-report";
import { SECTOR_LABELS, sectorLabel } from "@/lib/constants";
import { siteUrl } from "@/lib/seo";

/**
 * Message prêt à publier (LinkedIn, Google Business…) construit uniquement à partir des
 * chiffres réels de la plateforme : aucun appel à un modèle, aucun coût, aucune invention.
 */
export type SocialPostFacts = {
  /** "today" : offres publiées aujourd'hui ; "week" : 7 derniers jours (aucune offre aujourd'hui) */
  period: "today" | "week";
  newCount: number;
  openTotal: number;
  sectors: { label: string; n: number }[];
  regions: { label: string; n: number }[];
  highlight: { title: string; buyer: string | null; deadline: string | null } | null;
};

const nf = new Intl.NumberFormat("fr-FR");
const day = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long" }).format(new Date(iso));
const plural = (n: number, one: string, many: string) => `${nf.format(n)} ${n > 1 ? many : one}`;

function top(values: (string | null)[], max = 3) {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .slice(0, max)
    .map(([label, n]) => ({ label, n }));
}

/** Texte du message (aucun chiffre qui ne vienne des faits). */
export function renderSocialPost(f: SocialPostFacts, base = siteUrl()): string | null {
  if (!f.newCount) return null;
  const when = f.period === "today" ? "aujourd'hui" : "ces 7 derniers jours";
  const lines = [`${plural(f.newCount, "nouvelle opportunité B2B publiée", "nouvelles opportunités B2B publiées")} ${when} en France sur LinkProB2B (marchés publics et besoins d'entreprises).`, ""];
  if (f.sectors.length) lines.push("Secteurs les plus actifs :", ...f.sectors.map((s) => `• ${s.label} : ${nf.format(s.n)}`), "");
  if (f.regions.length) lines.push("Régions :", ...f.regions.map((r) => `• ${r.label} : ${nf.format(r.n)}`), "");
  if (f.highlight) {
    const h = f.highlight;
    lines.push(`À la une : « ${h.title} »${h.buyer ? ` (${h.buyer})` : ""}${h.deadline ? `, réponse avant le ${day(h.deadline)}` : ""}.`, "");
  }
  if (f.openTotal) lines.push(`${plural(f.openTotal, "opportunité est ouverte", "opportunités sont ouvertes")} en ce moment.`);
  lines.push(`À consulter ici : ${base}/opportunites`, "", "#MarchésPublics #AppelsDOffres #B2B #PME #Entreprises");
  return lines.join("\n");
}

/** Faits du message : offres publiques et réelles (démo exclue), publiées aujourd'hui (heure de Paris). */
export async function loadSocialPostFacts(db: SupabaseClient<Database>, now = new Date()): Promise<SocialPostFacts> {
  const todayStart = parisDayStart(parisToday(now));
  const weekStart = new Date(todayStart.getTime() - 6 * 86_400_000);
  const nowIso = now.toISOString();
  const open = () =>
    db.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "PUBLISHED").eq("visibility", "PUBLIC").eq("is_demo", false).or(`response_deadline.is.null,response_deadline.gt.${nowIso}`);
  const [{ data: recent }, { count: openTotal }, { data: sectors }] = await Promise.all([
    db
      .from("opportunities")
      .select("title, sector_slug, region, response_deadline, published_at, origin, external_buyer_name")
      .eq("status", "PUBLISHED")
      .eq("visibility", "PUBLIC")
      .eq("is_demo", false)
      .gte("published_at", weekStart.toISOString())
      .lte("published_at", nowIso)
      .order("published_at", { ascending: false })
      .limit(1000),
    open(),
    db.from("sectors").select("slug, label"),
  ]);
  const labels = { ...SECTOR_LABELS, ...Object.fromEntries((sectors ?? []).map((s) => [s.slug, s.label])) };
  const week = recent ?? [];
  const today = week.filter((o) => o.published_at && new Date(o.published_at) >= todayStart);
  const period = today.length ? "today" : "week";
  const rows = today.length ? today : week;
  // Offre mise en avant : encore ouverte, la plus récente avec une date limite connue
  const h = rows.find((o) => o.response_deadline && o.response_deadline > nowIso) ?? null;
  return {
    period,
    newCount: rows.length,
    openTotal: openTotal ?? 0,
    sectors: top(rows.map((o) => (o.sector_slug ? sectorLabel(o.sector_slug, labels) : null))),
    regions: top(rows.map((o) => o.region)),
    highlight: h ? { title: h.title, buyer: h.origin === "EXTERNAL" ? h.external_buyer_name : null, deadline: h.response_deadline } : null,
  };
}
