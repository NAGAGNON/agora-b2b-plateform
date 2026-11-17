import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { offerState } from "@/lib/service-offers-core";
import { ConvertNeedButton, ModerateOfferButton } from "@/components/service-offers/offer-actions";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Disponibilités" };
export const dynamic = "force-dynamic";

const LABEL = { online: "En ligne", expired: "Expirée", archived: "Retirée par l'entreprise", removed: "Retirée par la modération" } as const;

/**
 * Disponibilités publiées par les entreprises (retrait avec motif), et besoins qui ressemblent à des
 * offres de services (repérés à la relecture automatique) : proposition de les republier en disponibilité.
 */
export default async function AdminServiceOffersPage() {
  await requireStaff();
  const db = createAdminClient();
  const [{ data: offers }, { data: flagged }] = await Promise.all([
    db.from("service_offers").select("id, title, status, expires_at, published_at, removed_reason, is_demo, company:companies(name, slug)").order("created_at", { ascending: false }).limit(200),
    db.from("audit_logs").select("entity_id, metadata, created_at").eq("action", "moderation.auto.manual").order("created_at", { ascending: false }).limit(300),
  ]);
  const ids = (offers ?? []).map((o) => o.id);
  const { data: convs } = ids.length ? await db.from("conversations").select("service_offer_id").in("service_offer_id", ids) : { data: [] };
  const contacts = new Map<string, number>();
  for (const c of convs ?? []) if (c.service_offer_id) contacts.set(c.service_offer_id, (contacts.get(c.service_offer_id) ?? 0) + 1);

  // Besoins signalés par la relecture comme des offres de services (« vend au lieu d'acheter »)
  const serviceLike = (flagged ?? []).filter((f) => /offre de service|prestataire|présente ses (?:services|prestations)|recherche (?:de )?marchés|cherche des clients/i.test(String((f.metadata as { reason?: string } | null)?.reason ?? "")));
  const needIds = [...new Set(serviceLike.map((f) => f.entity_id).filter((x): x is string => Boolean(x)))];
  const [{ data: needs }, { data: converted }] = await Promise.all([
    needIds.length ? db.from("opportunities").select("id, title, status, created_at, company:companies(name)").in("id", needIds) : Promise.resolve({ data: [] as never[] }),
    needIds.length ? db.from("service_offers").select("from_opportunity_id").in("from_opportunity_id", needIds) : Promise.resolve({ data: [] as never[] }),
  ]);
  const wasConverted = new Set((converted ?? []).map((s: { from_opportunity_id: string | null }) => s.from_opportunity_id));
  const reasonOf = new Map(serviceLike.map((f) => [f.entity_id, String((f.metadata as { reason?: string } | null)?.reason ?? "")]));
  const now = new Date();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Disponibilités</h1>
        <p className="mt-1 text-sm text-slate-600">
          Les entreprises annoncent ce qu&apos;elles peuvent faire ; les acheteurs leur écrivent par la messagerie. Aucun e-mail n&apos;est envoyé aux prospects pour une disponibilité.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-navy">Besoins qui ressemblent à une offre de services ({(needs ?? []).length})</h2>
        <p className="text-sm text-slate-600">Repérés à la relecture automatique. « Recatégoriser » déplace la publication dans « Disponibilités » : texte repris tel quel, besoin archivé (rien n&apos;est supprimé), entreprise prévenue. Les nouvelles publications de ce type sont déplacées automatiquement.</p>
        {(needs ?? []).length === 0 ? (
          <p className="rounded-xl bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">Aucun pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {(needs ?? []).map((n: { id: string; title: string; status: string; created_at: string; company: { name: string } | { name: string }[] | null }) => {
              const company = Array.isArray(n.company) ? n.company[0]?.name : n.company?.name;
              return (
                <li key={n.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy">
                      <Link href={`/opportunites/${n.id}`} className="hover:underline">
                        {n.title}
                      </Link>
                    </p>
                    <p className="text-xs text-slate-500">
                      {company ?? "—"} · {n.status} · publié le {formatDate(n.created_at)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{reasonOf.get(n.id)}</p>
                  </div>
                  {wasConverted.has(n.id) ? (
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800 ring-1 ring-teal/30">Dans « Disponibilités »</span>
                  ) : (
                    <ConvertNeedButton opportunityId={n.id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-navy">Disponibilités publiées ({(offers ?? []).length})</h2>
        {(offers ?? []).length === 0 ? (
          <p className="rounded-xl bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">Aucune disponibilité pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {(offers ?? []).map((o) => {
              const state = offerState(o, now);
              const company = Array.isArray(o.company) ? o.company[0] : o.company;
              return (
                <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200" data-testid="admin-offer">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy">
                      <Link href={`/disponibilites/${o.id}`} className="hover:underline">
                        {o.title}
                      </Link>
                      {o.is_demo && <span className="ml-2 text-xs text-slate-400">(démo)</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      {company?.name ?? "—"} · publiée le {formatDate(o.published_at)} · {contacts.get(o.id) ?? 0} contact(s)
                    </p>
                    {o.removed_reason && <p className="mt-1 text-sm text-rose-700">Motif : {o.removed_reason}</p>}
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs font-bold", state === "online" ? "bg-teal-50 text-teal-800" : state === "removed" ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-600")}>{LABEL[state]}</span>
                  {(state === "online" || state === "removed") && <ModerateOfferButton id={o.id} removed={state === "removed"} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
