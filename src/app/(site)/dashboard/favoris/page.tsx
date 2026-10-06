import Link from "next/link";
import { Heart, Search } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DemoBadge } from "@/components/demo";
import { OriginBadge } from "@/components/opportunities/opportunity-badge";
import { DeleteSavedSearchButton, RemoveFavoriteButton } from "@/components/dashboard/small-actions";
import { deadlineLabel, formatDate } from "@/lib/format";
import { SECTOR_LABELS } from "@/lib/constants";

export const metadata = { title: "Favoris" };

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <p className="px-5 py-6 text-sm text-slate-500">
      {text}{" "}
      <Link href={href} className="font-semibold text-teal-700 underline">
        {cta}
      </Link>
    </p>
  );
}

export default async function FavoritesPage() {
  const session = await requireSession("/dashboard/favoris");
  const supabase = await createClient();
  const [{ data: favs }, { data: searches }] = await Promise.all([
    supabase
      .from("favorites")
      .select("id, created_at, opportunity:opportunities(id, title, origin, type, status, response_deadline, is_demo), company:companies(id, slug, name, city, is_demo)")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false }),
    supabase.from("saved_searches").select("*").eq("user_id", session.userId).order("created_at", { ascending: false }),
  ]);
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const opps = (favs ?? []).map((f) => one(f.opportunity)).filter(Boolean) as NonNullable<ReturnType<typeof one<{ id: string; title: string; origin: "INTERNAL" | "EXTERNAL"; type: never; status: string; response_deadline: string | null; is_demo: boolean }>>>[];
  const companies = (favs ?? []).map((f) => one(f.company)).filter(Boolean) as { id: string; slug: string; name: string; city: string | null; is_demo: boolean }[];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Favoris</h1>
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Heart className="size-5 text-teal-600" aria-hidden /> Opportunités</span>} description={`${opps.length} enregistrée(s)`} />
        {opps.length === 0 ? (
          <Empty text="Aucune opportunité enregistrée." href="/opportunites" cta="Explorer les opportunités" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {opps.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    <OriginBadge origin={o.origin} type={o.type} />
                    <StatusBadge kind="opportunity" status={o.status === "PUBLISHED" && o.response_deadline && new Date(o.response_deadline) < new Date() ? "EXPIRED" : o.status} />
                    {o.is_demo && <DemoBadge />}
                  </div>
                  <Link href={`/opportunites/${o.id}`} className="mt-1 block font-semibold text-navy hover:text-teal-700">
                    {o.title}
                  </Link>
                  {o.response_deadline && <p className="text-xs text-slate-500">{deadlineLabel(o.response_deadline)}</p>}
                </div>
                <RemoveFavoriteButton target="opportunity" id={o.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader title="Entreprises" description={`${companies.length} enregistrée(s)`} />
        {companies.length === 0 ? (
          <Empty text="Aucune entreprise enregistrée." href="/entreprises" cta="Parcourir l'annuaire" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {companies.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/entreprises/${c.slug}`} className="font-semibold text-navy hover:text-teal-700">
                    {c.name}
                  </Link>{" "}
                  {c.is_demo && <DemoBadge />}
                  <p className="text-xs text-slate-500">{c.city}</p>
                </div>
                <RemoveFavoriteButton target="company" id={c.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Search className="size-5 text-teal-600" aria-hidden /> Recherches sauvegardées</span>} />
        {!searches?.length ? (
          <Empty text="Aucune recherche sauvegardée. Depuis les résultats de recherche, cliquez sur « Sauvegarder la recherche »." href="/opportunites" cta="Rechercher" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {searches.map((s) => {
              const q = new URLSearchParams(s.query as Record<string, string>).toString();
              const href = `${s.scope === "COMPANIES" ? "/entreprises" : "/opportunites"}${q ? `?${q}` : ""}`;
              const params = s.query as Record<string, string>;
              return (
                <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={href} className="font-semibold text-navy hover:text-teal-700">
                      {s.name}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {s.scope === "COMPANIES" ? "Annuaire" : "Opportunités"} · {[params.q, params.secteur && SECTOR_LABELS[params.secteur], params.departement && `dép. ${params.departement}`, params.lieu && `${params.lieu} (${params.rayon ?? 50} km)`].filter(Boolean).join(" · ") || "tous critères"} · {formatDate(s.created_at)}
                    </p>
                  </div>
                  <DeleteSavedSearchButton id={s.id} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
