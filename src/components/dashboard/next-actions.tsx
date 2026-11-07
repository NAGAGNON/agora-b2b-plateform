import Link from "next/link";
import { AlarmClock, ArrowRight, CalendarClock, CheckCircle2, FileEdit, HelpCircle, Inbox, Lightbulb, MessageSquare, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const DAY = 86_400_000;

type Action = { key: string; icon: typeof Inbox; tone: "urgent" | "normal"; title: string; detail?: string; href: string; cta: string };

/**
 * « À faire maintenant » : actions concrètes calculées à partir des données réelles de l'entreprise
 * (réponses à examiner, messages non lus, échéances, relances, précisions demandées). Aucune estimation.
 */
export async function NextActions({ companyId, userId, buyer, supplier, now }: { companyId: string; userId: string; buyer: boolean; supplier: boolean; now: number }) {
  const supabase = await createClient();
  const soon = (days: number) => new Date(now + days * DAY).toISOString();
  const nowIso = new Date(now).toISOString();
  const [toReviewP, toReviewI, myNeeds, unread, infoP, infoI, followUps, favs] = await Promise.all([
    buyer
      ? supabase
          .from("proposals")
          .select("id, opportunity:opportunities!proposals_opportunity_id_fkey!inner(id, title, company_id)")
          .eq("opportunity.company_id", companyId)
          .eq("status", "SUBMITTED")
          .limit(50)
      : null,
    buyer
      ? supabase.from("interests").select("id, opportunity:opportunities!inner(id, title, company_id)").eq("opportunity.company_id", companyId).eq("status", "PENDING").limit(50)
      : null,
    buyer
      ? supabase
          .from("opportunities")
          .select("id, title, status, response_deadline, published_at, interests(count), proposals!proposals_opportunity_id_fkey(count)")
          .eq("company_id", companyId)
          .in("status", ["PUBLISHED", "DRAFT", "CHANGES_REQUESTED"])
          .limit(30)
      : null,
    supabase.from("messages").select("id, conversation_id", { count: "exact" }).is("read_at", null).neq("sender_company_id", companyId).limit(1),
    supplier ? supabase.from("proposals").select("id, opportunity:opportunities!proposals_opportunity_id_fkey(id, title)").eq("company_id", companyId).eq("status", "INFO_REQUESTED").limit(5) : null,
    supplier ? supabase.from("interests").select("id, opportunity:opportunities(id, title)").eq("company_id", companyId).eq("status", "INFO_REQUESTED").limit(5) : null,
    supplier
      ? supabase
          .from("pipeline_items")
          .select("id, next_action, next_action_at, opportunity:opportunities(id, title)")
          .eq("company_id", companyId)
          .not("next_action_at", "is", null)
          .lte("next_action_at", soon(1))
          .order("next_action_at")
          .limit(5)
      : null,
    supplier
      ? supabase
          .from("favorites")
          .select("id, opportunity:opportunities!inner(id, title, status, response_deadline)")
          .eq("user_id", userId)
          .eq("opportunity.status", "PUBLISHED")
          .gte("opportunity.response_deadline", nowIso)
          .lte("opportunity.response_deadline", soon(7))
          .limit(5)
      : null,
  ]);
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
  const actions: Action[] = [];

  // Demandeur : réponses et intérêts à examiner, regroupés par besoin
  const pendingByNeed = new Map<string, { title: string; n: number }>();
  for (const r of [...(toReviewP?.data ?? []), ...(toReviewI?.data ?? [])]) {
    const o = one(r.opportunity);
    if (!o) continue;
    const cur = pendingByNeed.get(o.id) ?? { title: o.title, n: 0 };
    cur.n++;
    pendingByNeed.set(o.id, cur);
  }
  for (const [id, v] of [...pendingByNeed.entries()].slice(0, 3)) {
    actions.push({
      key: `review-${id}`,
      icon: Inbox,
      tone: "urgent",
      title: `${v.n} nouvelle${v.n > 1 ? "s" : ""} réponse${v.n > 1 ? "s" : ""} à examiner`,
      detail: v.title,
      href: `/dashboard/opportunites/${id}`,
      cta: "Examiner",
    });
  }
  for (const o of myNeeds?.data ?? []) {
    const responses = (one(o.interests as { count: number }[] | null)?.count ?? 0) + (one(o.proposals as { count: number }[] | null)?.count ?? 0);
    if (o.status === "PUBLISHED" && o.response_deadline) {
      const left = new Date(o.response_deadline).getTime() - now;
      if (left > 0 && left <= 3 * DAY) {
        actions.push({ key: `deadline-${o.id}`, icon: CalendarClock, tone: "urgent", title: "Date limite de réponse dans moins de 3 jours", detail: o.title, href: `/dashboard/opportunites/${o.id}`, cta: "Voir le besoin" });
        continue;
      }
    }
    if (o.status === "PUBLISHED" && o.published_at && now - new Date(o.published_at).getTime() > 3 * DAY && responses === 0) {
      actions.push({ key: `improve-${o.id}`, icon: Lightbulb, tone: "normal", title: "Pas encore de réponse : améliorez votre besoin", detail: o.title, href: `/dashboard/opportunites/${o.id}`, cta: "Voir les conseils" });
    }
    if (o.status === "CHANGES_REQUESTED" || o.status === "DRAFT") {
      actions.push({
        key: `draft-${o.id}`,
        icon: FileEdit,
        tone: o.status === "CHANGES_REQUESTED" ? "urgent" : "normal",
        title: o.status === "CHANGES_REQUESTED" ? "La modération demande une modification" : "Brouillon à finaliser",
        detail: o.title,
        href: `/dashboard/opportunites/${o.id}`,
        cta: "Finaliser",
      });
    }
  }

  // Messages non lus
  if ((unread.count ?? 0) > 0) {
    const n = unread.count ?? 0;
    actions.unshift({ key: "unread", icon: MessageSquare, tone: "urgent", title: `${n} message${n > 1 ? "s" : ""} non lu${n > 1 ? "s" : ""}`, href: "/dashboard/messages", cta: "Lire" });
  }

  // Fournisseur : précisions demandées, relances prévues, favoris dont l'échéance approche
  for (const r of [...(infoP?.data ?? []), ...(infoI?.data ?? [])]) {
    const o = one(r.opportunity);
    if (o) actions.push({ key: `info-${r.id}`, icon: HelpCircle, tone: "urgent", title: "Le demandeur attend des précisions", detail: o.title, href: `/opportunites/${o.id}`, cta: "Répondre" });
  }
  for (const p of followUps?.data ?? []) {
    const o = one(p.opportunity);
    const late = p.next_action_at && new Date(p.next_action_at).getTime() < now;
    actions.push({
      key: `follow-${p.id}`,
      icon: AlarmClock,
      tone: late ? "urgent" : "normal",
      title: `${late ? "Relance en retard" : "Relance prévue"} : ${p.next_action || "prochaine action"}`,
      detail: o?.title,
      href: "/dashboard/pipeline",
      cta: "Ouvrir le pipeline",
    });
  }
  for (const f of favs?.data ?? []) {
    const o = one(f.opportunity);
    if (o) actions.push({ key: `fav-${f.id}`, icon: CalendarClock, tone: "normal", title: "Opportunité suivie : échéance dans moins de 7 jours", detail: o.title, href: `/opportunites/${o.id}`, cta: "Voir" });
  }

  const list = actions.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "urgent" ? -1 : 1)).slice(0, 8);
  return (
    <section aria-labelledby="a-faire" className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-48 rounded-full bg-gradient-to-br from-teal/15 to-electric/10 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-cyan-400 text-navy shadow-md" aria-hidden>
          <Zap className="size-5" />
        </span>
        <h2 id="a-faire" className="font-heading text-xl font-bold text-navy">
          À faire maintenant
        </h2>
        {list.length > 0 && <span className="rounded-full bg-navy px-2.5 py-0.5 text-xs font-bold text-white">{list.length}</span>}
      </div>
      {list.length === 0 ? (
        <p className="relative mt-4 flex items-center gap-2 rounded-2xl bg-teal-50/70 p-4 text-sm text-slate-700">
          <CheckCircle2 className="size-5 shrink-0 text-teal-600" aria-hidden /> Rien d&apos;urgent pour le moment. {supplier ? "Consultez vos recommandations ou " : ""}
          <Link href={supplier ? "/dashboard/recommandations" : "/publier"} className="font-semibold text-teal-700 underline">
            {supplier ? "les opportunités recommandées" : "publiez un besoin"}
          </Link>
          .
        </p>
      ) : (
        <ul className="relative mt-4 space-y-2">
          {list.map((a, i) => (
            <li
              key={a.key}
              style={{ animationDelay: `${i * 70}ms` }}
              className="group flex animate-rise flex-col gap-3 rounded-2xl bg-slate-50/80 p-3 ring-1 ring-slate-100 transition hover:bg-white hover:shadow-md hover:ring-teal/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-110 ${a.tone === "urgent" ? "bg-rose-100 text-rose-700" : "bg-teal-100 text-teal-800"}`}>
                  <a.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-navy">{a.title}</span>
                  {a.detail && <span className="block truncate text-sm text-slate-600">{a.detail}</span>}
                </span>
              </div>
              <Link href={a.href} className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-navy-900 sm:self-center">
                {a.cta} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
