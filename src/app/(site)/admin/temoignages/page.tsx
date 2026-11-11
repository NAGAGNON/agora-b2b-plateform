import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reviewTestimonial } from "@/app/actions/testimonials";
import { formatDateTime } from "@/lib/format";
import { MIN_TESTIMONIALS } from "@/components/home/testimonials";

export const metadata = { title: "Témoignages" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { PENDING: "À relire", APPROVED: "Publié", REJECTED: "Écarté" };

/** Relecture des avis des membres : publication seulement avec l'accord de l'auteur. */
export default async function TestimonialsAdminPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: rows }, { count: asked }] = await Promise.all([
    db.from("testimonials").select("id, author_name, author_role, company_name, quote, rating, consent_publish, status, created_at, user_id").order("created_at", { ascending: false }).limit(200),
    db.from("testimonial_requests").select("user_id", { count: "exact", head: true }),
  ]);
  const list = rows ?? [];
  const { data: users } = list.length ? await db.from("users").select("id, email").in("id", list.map((t) => t.user_id)) : { data: [] };
  const emails = new Map((users ?? []).map((u) => [u.id, u.email]));
  const published = list.filter((t) => t.status === "APPROVED" && t.consent_publish).length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Témoignages</h1>
        <p className="mt-1 text-sm text-slate-600">
          {asked ?? 0} demande(s) d&apos;avis envoyée(s) aux membres les plus actifs · {list.length} avis reçu(s) · {published} publié(s). La section de l&apos;accueil
          s&apos;affiche à partir de {MIN_TESTIMONIALS} avis publiés.
        </p>
      </div>
      {list.length === 0 && <p className="rounded-xl bg-white p-6 text-sm text-slate-600 ring-1 ring-slate-200">Aucun avis pour le moment.</p>}
      <ul className="space-y-4">
        {list.map((t) => (
          <li key={t.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="font-semibold text-navy">
                {t.author_name}
                {t.author_role ? ` · ${t.author_role}` : ""}
                {t.company_name ? ` · ${t.company_name}` : ""}
                <span className="ml-2 font-normal text-slate-500">{emails.get(t.user_id)}</span>
              </p>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{STATUS[t.status] ?? t.status}</span>
            </div>
            {t.rating && <p className="mt-3 text-lg tracking-wider text-teal-700" aria-label={`Note : ${t.rating} sur 5`}>{"★".repeat(t.rating)}<span className="text-slate-300">{"★".repeat(5 - t.rating)}</span></p>}
            {t.quote ? <blockquote className="mt-3 border-l-4 border-teal pl-4 text-slate-800">« {t.quote} »</blockquote> : <p className="mt-2 text-sm text-slate-500">Note en étoiles seulement, sans texte.</p>}
            <p className="mt-2 text-xs text-slate-500">
              
              {t.consent_publish ? "Accord de publication donné" : "Avis privé (pas d'accord de publication)"} · {formatDateTime(t.created_at)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {t.consent_publish && t.status !== "APPROVED" && (
                <form action={reviewTestimonial}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="decision" value="APPROVED" />
                  <button className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-navy">Publier</button>
                </form>
              )}
              {t.status !== "REJECTED" && (
                <form action={reviewTestimonial}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="decision" value="REJECTED" />
                  <button className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">{t.status === "APPROVED" ? "Retirer du site" : "Écarter"}</button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
