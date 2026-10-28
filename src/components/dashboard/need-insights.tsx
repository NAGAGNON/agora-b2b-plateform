import Link from "next/link";
import { Building2, CheckCircle2, Lightbulb, MapPin } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { buttonClasses } from "@/components/ui/button";

const DAY = 86_400_000;

type NeedFields = {
  id: string;
  title: string;
  description: string;
  budget_min: number | null;
  budget_max: number | null;
  response_deadline: string | null;
  skills: string[] | null;
  criteria: string | null;
  city: string | null;
  department_code: string | null;
  sector_slug: string | null;
  published_at: string | null;
  status: string;
};

/**
 * Conseils pour un besoin qui reçoit peu de réponses : uniquement à partir des champs réellement
 * renseignés (aucune estimation), après quelques jours de publication.
 */
export function NeedTips({ need, responses, documents, now }: { need: NeedFields; responses: number; documents: number; now: number }) {
  if (need.status !== "PUBLISHED" || !need.published_at || responses >= 2) return null;
  const age = (now - new Date(need.published_at).getTime()) / DAY;
  if (age < 3) return null;
  const tips: string[] = [];
  if (need.title.trim().length < 30) tips.push("Précisez le titre : nature de la prestation, lieu, quantité (ex. « Maintenance de 12 compresseurs à Rennes »).");
  if (need.description.trim().length < 400) tips.push("Détaillez la description : contexte, périmètre, contraintes techniques, livrables attendus.");
  if (need.budget_min == null && need.budget_max == null) tips.push("Indiquez un budget, même approximatif : les entreprises répondent plus volontiers quand l'enveloppe est connue.");
  if (!need.response_deadline) tips.push("Fixez une date limite de réponse : elle aide les entreprises à prioriser votre demande.");
  if (!(need.skills?.length) && !need.criteria) tips.push("Ajoutez les compétences ou critères attendus (certifications, références, délais d'intervention).");
  if (!need.city && !need.department_code) tips.push("Précisez la zone d'intervention : ville ou département.");
  if (!need.sector_slug) tips.push("Choisissez le secteur d'activité : il sert à prévenir les bonnes entreprises.");
  if (documents === 0) tips.push("Joignez un cahier des charges, un plan ou des photos si vous en avez.");
  if (!tips.length) tips.push("Votre besoin est complet. Partagez son lien (ci-dessus) auprès de votre réseau pour toucher davantage d'entreprises.");
  return (
    <section aria-labelledby="need-tips" className="rounded-2xl border border-amber/40 bg-amber-50 p-5">
      <h2 id="need-tips" className="flex items-center gap-2 font-heading text-lg font-bold text-navy">
        <Lightbulb className="size-5 text-amber-800" aria-hidden /> Recevez plus de réponses
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        Publié depuis {Math.floor(age)} jours, {responses === 0 ? "aucune réponse pour l'instant" : "une seule réponse pour l'instant"}. Quelques pistes, d&apos;après les
        informations renseignées :
      </p>
      <ul className="mt-3 space-y-2 text-sm text-slate-800">
        {tips.map((t) => (
          <li key={t} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-amber-800" aria-hidden /> {t}
          </li>
        ))}
      </ul>
      <Link href={`/dashboard/opportunites/${need.id}/modifier`} className={buttonClasses({ size: "sm", className: "mt-4" })}>
        Améliorer mon besoin
      </Link>
    </section>
  );
}

/**
 * Entreprises inscrites correspondant au besoin (calcul de mise en relation existant), limitées
 * à celles qui apparaissent dans l'annuaire. Les raisons affichées sont celles du calcul ; aucune
 * disponibilité ni intérêt n'est supposé.
 */
export async function NeedSuggestions({ needId, excludeCompanyIds }: { needId: string; excludeCompanyIds: string[] }) {
  const db = createAdminClient();
  const { data } = await db
    .from("need_matches")
    .select("company_id, score, reasons, status, company:companies(id, slug, name, city, is_public, status)")
    .eq("opportunity_id", needId)
    .order("score", { ascending: false })
    .limit(30);
  const rows = (data ?? [])
    .map((m) => ({ ...m, company: Array.isArray(m.company) ? m.company[0] : m.company }))
    .filter((m) => m.company && m.company.is_public && m.company.status === "ACTIVE" && !excludeCompanyIds.includes(m.company_id))
    .slice(0, 6);
  if (!rows.length) return null;
  return (
    <section aria-labelledby="need-suggestions" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="need-suggestions" className="flex items-center gap-2 font-heading text-lg font-bold text-navy">
        <Building2 className="size-5 text-teal-700" aria-hidden /> Entreprises qui correspondent à votre besoin
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Sélection automatique parmi les entreprises inscrites de l&apos;annuaire, d&apos;après le secteur, les compétences et la zone. Rien n&apos;indique leur
        disponibilité : consultez leur profil avant de les solliciter.
      </p>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {rows.map((m) => (
          <li key={m.company_id} className="glow-card rounded-xl border border-slate-200 p-4">
            <Link href={`/entreprises/${m.company!.slug}`} className="font-semibold text-navy hover:text-teal-700">
              {m.company!.name}
            </Link>
            {m.company!.city && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-600">
                <MapPin className="size-3.5" aria-hidden /> {m.company!.city}
              </p>
            )}
            {m.reasons.length > 0 && <p className="mt-2 text-sm text-slate-700">Pourquoi : {m.reasons.slice(0, 3).join(", ").toLowerCase()}.</p>}
            {["NOTIFIED", "REMINDED"].includes(m.status) && <p className="mt-1 text-xs font-medium text-teal-700">Prévenue de votre besoin par LinkProB2B</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
