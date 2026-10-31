import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";
import { recipientFromReferral } from "@/lib/outreach/tracking";
import { siteUrl } from "@/lib/seo";
import { sendWelcome } from "@/lib/email/auth-emails";

type Criteria = { sector: string | null; department: string | null };

const OFFER_PATH = /^\/opportunites\/([0-9a-f-]{36})(?:[/?#]|$)/i;

/**
 * Ce que l'on sait de la personne au moment de l'inscription, sans rien inventer : l'offre qu'elle
 * voulait ouvrir (page de retour), sinon l'e-mail de prospection qui l'a amenée (offre proposée et
 * département de son entreprise).
 */
export async function signupCriteria(next: string | null | undefined, ref: FormDataEntryValue | string | null | undefined): Promise<Criteria | null> {
  const db = createAdminClient();
  const offerId = next ? OFFER_PATH.exec(next)?.[1] : undefined;
  if (offerId) {
    const { data: o } = await db.from("opportunities").select("sector_slug, department_code").eq("id", offerId).maybeSingle();
    if (o?.sector_slug) return { sector: o.sector_slug, department: o.department_code };
  }
  const r = typeof ref === "string" ? await recipientFromReferral(ref) : null;
  if (r) {
    const [{ data: link }, { data: p }] = await Promise.all([
      db.from("outreach_recipient_opportunities").select("opportunity:opportunities(sector_slug)").eq("recipient_id", r.id).limit(1).maybeSingle(),
      db.from("outreach_prospects").select("department_code, sectors").eq("id", r.prospect_id).maybeSingle(),
    ]);
    const opp = Array.isArray(link?.opportunity) ? link?.opportunity[0] : link?.opportunity;
    const sector = opp?.sector_slug ?? p?.sectors?.[0] ?? null;
    if (sector) return { sector, department: p?.department_code ?? null };
  }
  return null;
}

/**
 * Alerte de départ créée à l'inscription (secteur et département connus) : la personne reçoit les
 * nouvelles offres de son métier sans avoir à la configurer. Une seule, uniquement si elle n'en a
 * aucune ; modifiable ou arrêtable en un clic (Alertes, lien dans chaque e-mail). Jamais bloquant.
 */
export async function createStarterAlert(userId: string, criteria: Criteria | null): Promise<boolean> {
  if (!criteria?.sector) return false;
  try {
    const db = createAdminClient();
    const { count } = await db.from("alerts").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (count) return false;
    const [{ data: s }, { data: d }] = await Promise.all([
      db.from("sectors").select("label").eq("slug", criteria.sector).maybeSingle(),
      criteria.department ? db.from("departments").select("name").eq("code", criteria.department).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const name = [s?.label ?? "Mon secteur", d?.name].filter(Boolean).join(" — ").slice(0, 120);
    const { error } = await db.from("alerts").insert({ user_id: userId, name, sector_slug: criteria.sector, department_code: criteria.department, frequency: "DAILY" });
    if (error) throw error;
    return true;
  } catch (e) {
    logServerError("starter alert", e);
    return false;
  }
}

/** Offres ouvertes les plus récentes du secteur (et du département s'il y en a assez), pour l'e-mail de bienvenue. */
export async function welcomeOffers(criteria: Criteria | null, limit = 4): Promise<{ label: string; url: string }[]> {
  if (!criteria?.sector) return [];
  try {
    const db = createAdminClient();
    const base = () =>
      db
        .from("opportunities")
        .select("id, title")
        .eq("status", "PUBLISHED")
        .eq("visibility", "PUBLIC")
        .eq("is_demo", false)
        .eq("sector_slug", criteria.sector!)
        .or(`response_deadline.is.null,response_deadline.gt.${new Date().toISOString()}`)
        .order("published_at", { ascending: false })
        .limit(limit);
    let rows = criteria.department ? (await base().eq("department_code", criteria.department)).data ?? [] : [];
    if (rows.length < 2) rows = (await base()).data ?? [];
    return rows.map((o) => ({ label: o.title, url: `${siteUrl()}/opportunites/${o.id}` }));
  } catch (e) {
    logServerError("welcome offers", e);
    return [];
  }
}

/** Accueil d'un nouvel inscrit : alerte de départ (si possible) puis e-mail de bienvenue avec les offres de son domaine. */
export async function welcomeNewMember(user: { id: string; email: string }, next: string | null | undefined, ref?: FormDataEntryValue | string | null) {
  const criteria = await signupCriteria(next, ref ?? null).catch(() => null);
  const created = await createStarterAlert(user.id, criteria);
  let alertName: string | null = null;
  if (created) {
    const { data } = await createAdminClient().from("alerts").select("name").eq("user_id", user.id).order("created_at").limit(1).maybeSingle();
    alertName = data?.name ?? null;
  }
  await sendWelcome(user.email, user.id, { offers: await welcomeOffers(criteria), alertName });
}
