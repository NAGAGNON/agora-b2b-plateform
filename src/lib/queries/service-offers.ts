import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Champs d'une disponibilité affichés dans les listes et sur sa page. */
const FIELDS =
  "id, title, description, sector_slug, department_code, city, nationwide, available_from, available_until, capacity, status, published_at, expires_at, created_at, company_id, is_demo, from_opportunity_id, removed_reason, company:companies(id, name, slug, logo_path, verified_at, city)";

export type ServiceOfferCompany = { id: string; name: string; slug: string; logo_path: string | null; verified_at: string | null; city: string | null };
export type ServiceOffer = {
  id: string;
  title: string;
  description: string;
  sector_slug: string | null;
  department_code: string | null;
  city: string | null;
  nationwide: boolean;
  available_from: string | null;
  available_until: string | null;
  capacity: string | null;
  status: string;
  published_at: string;
  expires_at: string;
  created_at: string;
  company_id: string;
  is_demo: boolean;
  from_opportunity_id: string | null;
  removed_reason: string | null;
  company: ServiceOfferCompany | null;
};

const one = (o: Record<string, unknown>): ServiceOffer => {
  const c = o.company as ServiceOfferCompany | ServiceOfferCompany[] | null;
  return { ...(o as unknown as ServiceOffer), company: Array.isArray(c) ? (c[0] ?? null) : c };
};

/** Disponibilités en ligne (métier, département : celles de ce département et celles de toute la France). */
export async function listServiceOffers({ sector, department, demo = false, limit = 60 }: { sector?: string | null; department?: string | null; demo?: boolean; limit?: number } = {}) {
  const supabase = await createClient();
  let q = supabase.from("service_offers").select(FIELDS).eq("status", "PUBLISHED").gt("expires_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(limit);
  if (!demo) q = q.eq("is_demo", false);
  if (sector) q = q.eq("sector_slug", sector);
  if (department) q = q.or(`department_code.eq.${department},nationwide.eq.true`);
  const { data } = await q;
  return (data ?? []).map((o) => one(o as Record<string, unknown>));
}

/** Une disponibilité (en ligne pour tous ; toutes pour son entreprise et l'équipe, selon les règles de la base). */
export async function getServiceOffer(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("service_offers").select(FIELDS).eq("id", id).maybeSingle();
  return data ? one(data as Record<string, unknown>) : null;
}

/** Disponibilités en ligne d'une entreprise (fiche publique de l'entreprise). */
export async function companyServiceOffers(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_offers")
    .select(FIELDS)
    .eq("company_id", companyId)
    .eq("status", "PUBLISHED")
    .gt("expires_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(5);
  return (data ?? []).map((o) => one(o as Record<string, unknown>));
}

/** Toutes les disponibilités de l'entreprise active, avec le nombre d'entreprises qui l'ont contactée. */
export async function myServiceOffers(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("service_offers").select(FIELDS).eq("company_id", companyId).order("created_at", { ascending: false }).limit(50);
  const offers = (data ?? []).map((o) => one(o as Record<string, unknown>));
  const { data: convs } = offers.length ? await supabase.from("conversations").select("service_offer_id").in("service_offer_id", offers.map((o) => o.id)) : { data: [] };
  const contacts = new Map<string, number>();
  for (const c of convs ?? []) if (c.service_offer_id) contacts.set(c.service_offer_id, (contacts.get(c.service_offer_id) ?? 0) + 1);
  return offers.map((o) => ({ ...o, contacts: contacts.get(o.id) ?? 0 }));
}
