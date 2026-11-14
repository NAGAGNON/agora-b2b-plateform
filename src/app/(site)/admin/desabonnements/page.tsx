import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardCard } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Désabonnements" };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const nowMs = () => Date.now();

const KIND_LABEL: Record<string, string> = {
  AUTO: "Prospection (opportunités)",
  MANUAL: "Prospection (campagne manuelle)",
  NEED: "Besoin d'une entreprise",
  BOOST: "Présentation d'entreprise (Visibilité)",
};

type Row = { at: string; source: string; who: string; detail: string; email: string | null };

/**
 * Désabonnements : prospection (entreprises de la base), veille des membres, alertes sans compte.
 * Taux calculés sur les e-mails envoyés pendant la même période. Données internes, aucune action.
 */
export default async function UnsubscribesPage() {
  await requireAdmin();
  const db = createAdminClient();
  const now = nowMs();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const since7 = new Date(now - 7 * DAY).toISOString();

  const [outEvents, outSent30, outSent7, veilleUnsub, veilleSent30, veilleSent7, leadsUnsub, leadsActive, alertsOff, notifyOff] = await Promise.all([
    db.from("outreach_events").select("created_at, recipient_id, campaign_id").eq("type", "UNSUBSCRIBE").order("created_at", { ascending: false }).limit(300),
    db.from("outreach_recipients").select("id", { count: "exact", head: true }).gte("sent_at", since30),
    db.from("outreach_recipients").select("id", { count: "exact", head: true }).gte("sent_at", since7),
    db.from("veille_sends").select("unsubscribed_at, email, user_id, subject").not("unsubscribed_at", "is", null).order("unsubscribed_at", { ascending: false }).limit(300),
    db.from("veille_sends").select("id", { count: "exact", head: true }).gte("sent_at", since30),
    db.from("veille_sends").select("id", { count: "exact", head: true }).gte("sent_at", since7),
    db.from("alert_leads").select("unsubscribed_at, email, buyer_name, sector_slug, department_code").eq("status", "UNSUBSCRIBED").order("unsubscribed_at", { ascending: false }).limit(300),
    db.from("alert_leads").select("id", { count: "exact", head: true }).eq("status", "CONFIRMED"),
    db.from("alerts").select("id", { count: "exact", head: true }).eq("is_active", false),
    db.from("users").select("id", { count: "exact", head: true }).eq("notify_email", false),
  ]);

  // Détails de la prospection : entreprise et type de campagne
  const ev = (outEvents.data ?? []).filter((e): e is typeof e & { recipient_id: string; campaign_id: string } => Boolean(e.recipient_id && e.campaign_id));
  const [{ data: recipients }, { data: campaigns }] = await Promise.all([
    ev.length ? db.from("outreach_recipients").select("id, email, prospect_id").in("id", [...new Set(ev.map((e) => e.recipient_id))]) : Promise.resolve({ data: [] as { id: string; email: string | null; prospect_id: string }[] }),
    ev.length ? db.from("outreach_campaigns").select("id, kind, campaign_date").in("id", [...new Set(ev.map((e) => e.campaign_id))]) : Promise.resolve({ data: [] as { id: string; kind: string; campaign_date: string }[] }),
  ]);
  const recipient = new Map((recipients ?? []).map((r) => [r.id, r]));
  const campaign = new Map((campaigns ?? []).map((c) => [c.id, c]));
  const prospectIds = [...new Set((recipients ?? []).map((r) => r.prospect_id))];
  const { data: prospects } = prospectIds.length
    ? await db.from("outreach_prospects").select("id, name, city").in("id", prospectIds)
    : { data: [] as { id: string; name: string; city: string | null }[] };
  const prospect = new Map((prospects ?? []).map((p) => [p.id, p]));

  const veille = veilleUnsub.data ?? [];
  const userIds = [...new Set(veille.map((v) => v.user_id))];
  const { data: users } = userIds.length ? await db.from("users").select("id, full_name").in("id", userIds) : { data: [] as { id: string; full_name: string }[] };
  const userName = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  const rows: Row[] = [
    ...ev.map((e) => {
      const r = recipient.get(e.recipient_id);
      const p = r ? prospect.get(r.prospect_id) : undefined;
      const c = campaign.get(e.campaign_id);
      return {
        at: e.created_at,
        source: "Prospection",
        who: p ? `${p.name}${p.city ? ` (${p.city})` : ""}` : "Entreprise de la base",
        detail: c ? `${KIND_LABEL[c.kind] ?? c.kind} · campagne du ${new Date(c.campaign_date).toLocaleDateString("fr-FR")}` : "—",
        email: r?.email ?? null,
      };
    }),
    ...veille.map((v) => ({ at: v.unsubscribed_at!, source: "Veille (membre)", who: userName.get(v.user_id) || v.email, detail: v.subject ?? "E-mail de veille", email: v.email })),
    ...(leadsUnsub.data ?? []).map((l) => ({
      at: l.unsubscribed_at ?? "",
      source: "Alerte sans compte",
      who: l.email,
      detail: [l.buyer_name, l.sector_slug, l.department_code].filter(Boolean).join(" · ") || "Alerte",
      email: l.email,
    })),
  ]
    .filter((r) => r.at)
    .sort((a, b) => b.at.localeCompare(a.at));

  const inRange = (from: string, list: { at: string }[]) => list.filter((r) => r.at >= from).length;
  const out30 = inRange(since30, rows.filter((r) => r.source === "Prospection"));
  const out7 = inRange(since7, rows.filter((r) => r.source === "Prospection"));
  const vei30 = inRange(since30, rows.filter((r) => r.source === "Veille (membre)"));
  const lead30 = inRange(since30, rows.filter((r) => r.source === "Alerte sans compte"));
  const pct = (a: number, b: number | null) => (b ? `${((a / b) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—");

  // 14 derniers jours (heure de Paris)
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
  const days = Array.from({ length: 14 }, (_, i) => dayKey(new Date(now - (13 - i) * DAY).toISOString()));
  const perDay = days.map((d) => ({
    d,
    out: rows.filter((r) => r.source === "Prospection" && dayKey(r.at) === d).length,
    other: rows.filter((r) => r.source !== "Prospection" && dayKey(r.at) === d).length,
  }));
  const maxDay = Math.max(1, ...perDay.map((x) => x.out + x.other));
  const outRate7 = outSent7.count ? out7 / outSent7.count : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Désabonnements</h1>
        <p className="mt-1 text-slate-600">
          Personnes et entreprises qui ont demandé à ne plus recevoir nos e-mails : prospection (entreprises de la base), veille des membres et alertes sans compte.
          Chaque désabonnement est appliqué automatiquement (plus aucun envoi).
        </p>
      </div>

      {outRate7 > 0.01 && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 ring-1 ring-red-200">
          Attention : {pct(out7, outSent7.count)} de désabonnements sur la prospection des 7 derniers jours (au-delà de 1 %). Vérifiez le ciblage et le texte des e-mails.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <DashboardCard label="Prospection (30 j)" value={out30} hint={`${pct(out30, outSent30.count)} des ${outSent30.count ?? 0} e-mails envoyés`} />
        <DashboardCard label="Prospection (7 j)" value={out7} hint={`${pct(out7, outSent7.count)} des ${outSent7.count ?? 0} e-mails envoyés`} />
        <DashboardCard label="Veille (30 j)" value={vei30} hint={`${pct(vei30, veilleSent30.count)} des ${veilleSent30.count ?? 0} e-mails · ${veilleSent7.count ?? 0} sur 7 j`} />
        <DashboardCard label="Alertes sans compte (30 j)" value={lead30} hint={`${leadsActive.count ?? 0} alerte(s) active(s)`} />
        <DashboardCard label="Alertes de membres désactivées" value={alertsOff.count ?? 0} hint="Lien « se désabonner » ou réglage" />
        <DashboardCard label="Membres sans e-mails" value={notifyOff.count ?? 0} hint="Notifications par e-mail coupées" />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-navy">14 derniers jours</h2>
        <div className="mt-4 flex h-32 items-end gap-1.5" role="img" aria-label="Désabonnements par jour sur 14 jours">
          {perDay.map((x) => (
            <div key={x.d} className="group relative flex h-full flex-1 flex-col justify-end" title={`${new Date(x.d).toLocaleDateString("fr-FR")} : ${x.out} prospection, ${x.other} autres`}>
              {x.other > 0 && <div className="rounded-t bg-violet/70" style={{ height: `${(x.other / maxDay) * 100}%` }} />}
              {x.out > 0 && <div className={x.other ? "bg-navy" : "rounded-t bg-navy"} style={{ height: `${(x.out / maxDay) * 100}%` }} />}
              {x.out + x.other === 0 && <div className="h-px bg-slate-200" />}
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          <span>{new Date(days[0]).toLocaleDateString("fr-FR")}</span>
          <span>{new Date(days[days.length - 1]).toLocaleDateString("fr-FR")}</span>
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-navy" aria-hidden /> Prospection</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-violet/70" aria-hidden /> Veille et alertes</span>
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="px-3 pt-3 text-left font-semibold text-navy">Derniers désabonnements</caption>
          <thead className="bg-canvas text-left text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">Date</th>
              <th scope="col" className="px-3 py-2">Origine</th>
              <th scope="col" className="px-3 py-2">Qui</th>
              <th scope="col" className="px-3 py-2">E-mail reçu</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-slate-600">Aucun désabonnement pour l&apos;instant.</td>
              </tr>
            ) : (
              rows.slice(0, 200).map((r, i) => (
                <tr key={i} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDateTime(r.at)}</td>
                  <td className="px-3 py-2">
                    <span className={r.source === "Prospection" ? "rounded-full bg-navy/10 px-2 py-0.5 text-xs font-semibold text-navy" : "rounded-full bg-violet/10 px-2 py-0.5 text-xs font-semibold text-violet"}>{r.source}</span>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-navy">{r.who}</p>
                    {r.email && r.email !== r.who && <p className="text-xs text-slate-500">{r.email}</p>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{r.detail}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
