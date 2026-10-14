import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Détail des inscriptions pour le tableau de bord : qui, quand, par quel chemin, ce qui a été
 * rempli et ce qui s'est passé ensuite. Uniquement des données enregistrées par la plateforme.
 */
export type SignupDetail = {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  phone: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  status: string;
  isDemo: boolean;
  marketingConsent: boolean;
  notifyEmail: boolean;
  termsAcceptedAt: string | null;
  /** null : inconnu (compte introuvable côté authentification) */
  emailConfirmedAt: string | null | undefined;
  origin: { kind: "outreach"; campaignDate: string | null; prospectName: string | null; offerTitle: string | null } | { kind: "direct" };
  company: { id: string; name: string; siren: string | null; kind: string; size: string | null; city: string | null; postalCode: string | null; region: string | null; website: string | null; status: string; planCode: string; createdAt: string; sectors: string[]; profileFilled: boolean } | null;
  activity: { alerts: number; interests: number; proposals: number; favorites: number; savedSearches: number; subscription: string | null; events: { name: string; at: string }[] };
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export async function loadSignups(db: SupabaseClient<Database>, opts: { page: number; per: number; includeDemo?: boolean }): Promise<{ rows: SignupDetail[]; count: number }> {
  let q = db
    .from("users")
    .select("id, email, full_name, job_title, phone, created_at, last_seen_at, status, is_demo, marketing_consent, notify_email, terms_accepted_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((opts.page - 1) * opts.per, opts.page * opts.per - 1);
  if (!opts.includeDemo) q = q.eq("is_demo", false);
  const { data: users, count, error } = await q;
  if (error) throw error;
  if (!users?.length) return { rows: [], count: count ?? 0 };
  const ids = users.map((u) => u.id);
  const emails = users.map((u) => u.email.toLowerCase());

  const [members, alerts, interests, favorites, searches, events, outreachByUser, outreachByEmail] = await Promise.all([
    db.from("company_members").select("user_id, company:companies(id, name, siren, kind, size, city, postal_code, region, website, status, plan_code, created_at, profile:company_profiles(sectors, description))").in("user_id", ids),
    db.from("alerts").select("user_id").in("user_id", ids),
    db.from("interests").select("user_id").in("user_id", ids),
    db.from("favorites").select("user_id").in("user_id", ids),
    db.from("saved_searches").select("user_id").in("user_id", ids),
    db.from("analytics_events").select("user_id, event_name, created_at").in("user_id", ids).order("created_at", { ascending: true }).limit(1000),
    db.from("outreach_events").select("user_id, recipient:outreach_recipients(email, campaign:outreach_campaigns(campaign_date), prospect:outreach_prospects(name)), opportunity:opportunities(title)").eq("type", "SIGNUP").in("user_id", ids),
    db.from("outreach_recipients").select("email, signed_up_at, campaign:outreach_campaigns(campaign_date), prospect:outreach_prospects(name)").in("email", emails).not("signed_up_at", "is", null),
  ]);

  const companyIds = [...new Set((members.data ?? []).map((m) => one(m.company)?.id).filter((x): x is string => Boolean(x)))];
  const [proposals, subs] = companyIds.length
    ? await Promise.all([
        db.from("proposals").select("company_id").in("company_id", companyIds),
        db.from("subscriptions").select("company_id, plan_code, status").in("company_id", companyIds),
      ])
    : [{ data: [] as { company_id: string }[] }, { data: [] as { company_id: string; plan_code: string; status: string }[] }];

  const countBy = <K extends string>(rows: Record<K, string | null>[] | null | undefined, key: K) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r[key]) m.set(r[key]!, (m.get(r[key]!) ?? 0) + 1);
    return m;
  };
  const nAlerts = countBy(alerts.data, "user_id");
  const nInterests = countBy(interests.data, "user_id");
  const nFav = countBy(favorites.data, "user_id");
  const nSearch = countBy(searches.data, "user_id");
  const nProposals = countBy(proposals.data, "company_id");

  // Confirmation de l'adresse e-mail (compte d'authentification)
  const confirmed = new Map<string, string | null | undefined>();
  await Promise.all(
    ids.map(async (id) => {
      const { data } = await db.auth.admin.getUserById(id);
      confirmed.set(id, data?.user ? (data.user.email_confirmed_at ?? null) : undefined);
    }),
  );

  const rows = users.map((u): SignupDetail => {
    const m = (members.data ?? []).find((x) => x.user_id === u.id);
    const c = one(m?.company);
    const profile = one(c?.profile as { sectors: string[]; description: string | null } | { sectors: string[]; description: string | null }[] | null);
    const sub = c ? (subs.data ?? []).find((s) => s.company_id === c.id) : null;
    const ev = (outreachByUser.data ?? []).find((e) => e.user_id === u.id);
    const byEmail = (outreachByEmail.data ?? []).find((r) => r.email?.toLowerCase() === u.email.toLowerCase());
    const rec = ev ? one(ev.recipient) : byEmail;
    const origin: SignupDetail["origin"] = rec
      ? { kind: "outreach", campaignDate: one(rec.campaign)?.campaign_date ?? null, prospectName: one(rec.prospect)?.name ?? null, offerTitle: ev ? (one(ev.opportunity)?.title ?? null) : null }
      : { kind: "direct" };
    return {
      id: u.id,
      email: u.email,
      fullName: u.full_name,
      jobTitle: u.job_title,
      phone: u.phone,
      createdAt: u.created_at,
      lastSeenAt: u.last_seen_at,
      status: u.status,
      isDemo: u.is_demo,
      marketingConsent: u.marketing_consent,
      notifyEmail: u.notify_email,
      termsAcceptedAt: u.terms_accepted_at,
      emailConfirmedAt: confirmed.get(u.id),
      origin,
      company: c
        ? { id: c.id, name: c.name, siren: c.siren, kind: c.kind, size: c.size, city: c.city, postalCode: c.postal_code, region: c.region, website: c.website, status: c.status, planCode: c.plan_code, createdAt: c.created_at, sectors: profile?.sectors ?? [], profileFilled: Boolean(profile?.description) }
        : null,
      activity: {
        alerts: nAlerts.get(u.id) ?? 0,
        interests: nInterests.get(u.id) ?? 0,
        proposals: c ? (nProposals.get(c.id) ?? 0) : 0,
        favorites: nFav.get(u.id) ?? 0,
        savedSearches: nSearch.get(u.id) ?? 0,
        subscription: sub ? `${sub.plan_code} (${sub.status})` : null,
        events: (events.data ?? []).filter((e) => e.user_id === u.id).map((e) => ({ name: e.event_name, at: e.created_at })),
      },
    };
  });
  return { rows, count: count ?? 0 };
}

export type ActivationFunnel = { signups: number; company: number; profile: number; alert: number; veille: number; favorite: number; eligible7: number; returned: number; returned7: number };

/**
 * Entonnoir d'activation des comptes réels (démo exclue) : entreprise créée, profil complété,
 * alerte, veille, favori ; retours : revenu après le jour de l'inscription, et encore actif 7 jours
 * après (comptes de plus de 7 jours). Calculé sur les données enregistrées, sans estimation.
 */
export async function loadActivationFunnel(db: SupabaseClient<Database>, now = new Date()): Promise<ActivationFunnel> {
  const users: { id: string; created_at: string; last_seen_at: string | null; marketing_consent: boolean }[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await db.from("users").select("id, created_at, last_seen_at, marketing_consent").eq("is_demo", false).order("created_at").range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    users.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const ids = new Set(users.map((u) => u.id));
  const set = async (table: "alerts" | "favorites", col = "user_id") => {
    const { data } = await db.from(table).select(col).limit(50000);
    return new Set(((data ?? []) as unknown as Record<string, string>[]).map((r) => r[col]).filter((id) => ids.has(id)));
  };
  const [alerts, favorites, { data: members }, { data: prefs }] = await Promise.all([
    set("alerts"),
    set("favorites"),
    db.from("company_members").select("user_id, company:companies(is_demo, profile:company_profiles(sectors, skills, description))").limit(50000),
    db.from("veille_preferences").select("user_id, frequency, consent_at").limit(50000),
  ]);
  const withCompany = new Set<string>();
  const withProfile = new Set<string>();
  for (const m of members ?? []) {
    if (!ids.has(m.user_id)) continue;
    const c = one(m.company as unknown as { is_demo: boolean; profile: unknown } | null);
    if (!c || c.is_demo) continue;
    withCompany.add(m.user_id);
    const p = one(c.profile as { sectors: string[]; skills: string[]; description: string | null } | null);
    if (p?.sectors?.length && p.skills?.length && (p.description?.length ?? 0) >= 30) withProfile.add(m.user_id);
  }
  const prefBy = new Map((prefs ?? []).map((p) => [p.user_id, p]));
  const veille = users.filter((u) => {
    const p = prefBy.get(u.id);
    return p ? p.frequency !== "NONE" && (Boolean(p.consent_at) || u.marketing_consent) : u.marketing_consent;
  }).length;
  const day = 86_400_000;
  const old = users.filter((u) => now.getTime() - new Date(u.created_at).getTime() >= 7 * day);
  const after = (u: (typeof users)[number], ms: number) => Boolean(u.last_seen_at && new Date(u.last_seen_at).getTime() - new Date(u.created_at).getTime() >= ms);
  return {
    signups: users.length,
    company: withCompany.size,
    profile: withProfile.size,
    alert: alerts.size,
    veille,
    favorite: favorites.size,
    eligible7: old.length,
    returned: old.filter((u) => after(u, day)).length,
    returned7: old.filter((u) => after(u, 7 * day)).length,
  };
}
