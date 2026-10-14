import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { buttonClasses } from "@/components/ui/button";
import { setVeilleCampaignStatus } from "@/app/actions/veille-admin";
import { VeilleEnableForm, VeilleSmtpTest, VeilleTestForm } from "@/components/admin/veille-actions";
import { editionsFor, loadVeilleSettings, previewFor, veilleStats } from "@/lib/veille/engine";
import { criteriaFor } from "@/lib/veille/select";
import { veilleFrom } from "@/lib/veille/send";
import { checkDeliverability } from "@/lib/veille/deliverability";
import type { VeilleKind } from "@/lib/veille/render";
import { parisToday } from "@/lib/daily-report";

export const metadata = { title: "Veille par e-mail" };

const KIND_LABELS: Record<string, string> = { LAUNCH: "Lancement", MONDAY: "Lundi", FRIDAY: "Vendredi", DAILY: "Alerte quotidienne" };
const STATUS_LABELS: Record<string, string> = { BUILDING: "En préparation", SENDING: "En cours d'envoi", PAUSED: "Suspendue", SENT: "Envoyée", CANCELLED: "Annulée", EMPTY: "Rien à envoyer" };
const FREQ_LABELS: Record<string, string> = { TWICE_WEEKLY: "Lundi et vendredi", DAILY: "Quotidienne" };

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-navy">{value}</p>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default async function AdminVeille(props: PageProps<"/admin/veille">) {
  const session = await requireAdmin();
  const sp = await props.searchParams;
  const kind = (typeof sp.edition === "string" && sp.edition in KIND_LABELS ? sp.edition : "LAUNCH") as VeilleKind;
  const forUser = typeof sp.pour === "string" ? sp.pour : "";
  const db = createAdminClient();
  const from = veilleFrom();
  const domain = from.address.split("@")[1] ?? "";
  const [settings, stats, preview, dnsChecks] = await Promise.all([
    loadVeilleSettings(db),
    veilleStats(db),
    previewFor(db, kind, forUser || null),
    domain ? checkDeliverability(domain).catch(() => []) : Promise.resolve([]),
  ]);
  const today = parisToday();
  const launchDone = stats.campaigns.some((c) => c.kind === "LAUNCH");
  const next = editionsFor(today, settings, launchDone);
  const pct = (n: number) => (stats.sent ? `${Math.round((n / stats.sent) * 100)} %` : "—");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Veille par e-mail</h1>
        <p className="mt-1 text-sm text-slate-600">
          Sélections du lundi et du vendredi, alertes quotidiennes et e-mail de lancement. Chiffres issus des envois et événements réellement enregistrés.
        </p>
      </div>

      <Card>
        <CardHeader title="État et configuration" />
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Envois automatiques</dt>
              <dd className="font-semibold text-navy">{settings.enabled ? "Activés" : "Désactivés (aucun e-mail réel ne part)"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Service d&apos;envoi</dt>
              <dd className="font-semibold text-navy">
                {env.emailTransport === "smtp" ? "SMTP du domaine (sans coût par e-mail)" : env.emailTransport ? env.emailTransport : "Aucun — à configurer (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Expéditeur</dt>
              <dd className="font-semibold text-navy">{from.header}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Lancement</dt>
              <dd className="font-semibold text-navy">
                {launchDone ? "Effectué" : `Prévu le ${settings.launch_date.split("-").reverse().join("/")} vers 8 h (si les envois sont activés)`}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Éditions préparées aujourd&apos;hui</dt>
              <dd className="font-semibold text-navy">{settings.enabled ? next.map((k) => KIND_LABELS[k]).join(", ") || "Aucune" : "Aucune (envois désactivés)"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Dernier envoi test</dt>
              <dd className="font-semibold text-navy">{settings.test_sent_at ? `${formatDateTime(settings.test_sent_at)} à ${settings.test_sent_to}` : "Aucun"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Plafond quotidien</dt>
              <dd className="font-semibold text-navy">{settings.daily_cap} e-mails par jour, envoyés un par un</dd>
            </div>
          </dl>
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-navy">Authentification du domaine {domain}</h3>
              <ul className="space-y-1.5 text-sm" data-testid="dns-checks">
                {dnsChecks.length ? (
                  dnsChecks.map((c) => (
                    <li key={c.label}>
                      <span className={c.ok ? "font-semibold text-teal-700" : c.ok === null ? "font-semibold text-amber-700" : "font-semibold text-red-700"}>
                        {c.ok ? "✓" : c.ok === null ? "?" : "✗"} {c.label}
                      </span>{" "}
                      <span className="break-all text-slate-600">{c.detail}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-500">Vérification DNS indisponible depuis ce serveur.</li>
                )}
              </ul>
            </div>
            <VeilleSmtpTest />
            {from.address !== (env.emailFrom.match(/<(.+)>/)?.[1] ?? env.emailFrom) && (
              <Notice tone="warning">L&apos;adresse d&apos;expédition de la veille diffère de la boîte SMTP connectée : vérifiez que le serveur l&apos;autorise.</Notice>
            )}
          </div>
        </div>
        <div className="space-y-4 border-t border-slate-100 p-5">
          <VeilleTestForm defaultTo={session.email} kind={kind} user={forUser} />
          <VeilleEnableForm enabled={settings.enabled} />
          {!settings.enabled && <p className="text-xs text-slate-500">L&apos;activation n&apos;est possible qu&apos;après un envoi test réussi.</p>}
        </div>
      </Card>

      <section aria-label="Indicateurs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Destinataires éligibles" value={stats.eligible} hint={`${stats.personalized} avec critères`} />
        <Stat label="Lundi et vendredi" value={stats.twiceWeekly} />
        <Stat label="Alertes quotidiennes" value={stats.daily} />
        <Stat label="En attente d'envoi" value={stats.pending} />
        <Stat label="E-mails envoyés" value={stats.sent} hint="acceptés par le serveur d'envoi" />
        <Stat label="Ouvertures" value={stats.opened} hint={`${pct(stats.opened)} (indicatif : images souvent bloquées)`} />
        <Stat label="Clics" value={stats.clicked} hint={pct(stats.clicked)} />
        <Stat label="Désinscriptions" value={stats.unsubscribed} />
        <Stat label="Échecs" value={stats.failed} />
        <Stat label="Adresses invalides (rebonds)" value={stats.bounced} />
        <Stat label="Non envoyés" value={stats.skipped} hint="désinscrits ou annonces expirées" />
        <Stat label="Liste d'exclusion" value={Object.values(stats.suppressions).reduce((a, b) => a + b, 0)} />
      </section>

      <Card>
        <CardHeader title="Aperçu" description="Rendu réel avec les annonces ouvertes du moment. Rien n'est enregistré ni envoyé." />
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap gap-2">
            {Object.entries(KIND_LABELS).map(([k, l]) => (
              <Link key={k} href={`/admin/veille?edition=${k}${forUser ? `&pour=${forUser}` : ""}`} className={buttonClasses({ variant: k === kind ? "primary" : "outline", size: "sm" })}>
                {l}
              </Link>
            ))}
          </div>
          <p className="text-sm text-slate-600">
            {forUser ? `Pour ${preview.member.email || "cet utilisateur"}` : "Version générale (sans critères)"} — objet : <strong>{preview.email.subject}</strong> — {preview.items.length}{" "}
            opportunité(s).
            {forUser && (
              <>
                {" "}
                <Link href={`/admin/veille?edition=${kind}`} className="text-teal-700 underline">
                  Version générale
                </Link>
              </>
            )}
          </p>
          {preview.items.length ? (
            <iframe title="Aperçu de l'e-mail" srcDoc={preview.email.html} className="h-[720px] w-full rounded-lg border border-slate-200 bg-white" sandbox="" />
          ) : (
            <Notice tone="warning">Aucune opportunité pertinente : cet e-mail ne serait pas envoyé.</Notice>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title={`Destinataires éligibles (${stats.eligible})`} description="Compte actif, adresse confirmée, accord donné, pas désinscrit ni en liste d'exclusion." />
        <div className="overflow-x-auto p-5">
          {stats.audience.length ? (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Destinataire</th>
                  <th className="py-2 pr-3">Fréquence</th>
                  <th className="py-2 pr-3">Sélection</th>
                  <th className="py-2 pr-3">Accord</th>
                  <th className="py-2">Aperçu</th>
                </tr>
              </thead>
              <tbody>
                {stats.audience.map((m) => {
                  const basis = criteriaFor(m).basis;
                  return (
                    <tr key={m.user_id} className="border-t border-slate-100">
                      <td className="py-2 pr-3">
                        {m.full_name || "—"}
                        <span className="block text-xs text-slate-500">{m.email}</span>
                      </td>
                      <td className="py-2 pr-3">{FREQ_LABELS[m.frequency] ?? m.frequency}</td>
                      <td className="py-2 pr-3">{basis === "preferences" ? "Ses critères" : basis === "entreprise" ? "Secteurs de son entreprise" : "Générale"}</td>
                      <td className="py-2 pr-3">{m.consent === "veille" ? "Veille" : "Actualités"}</td>
                      <td className="py-2">
                        <Link href={`/admin/veille?edition=${kind}&pour=${m.user_id}`} className="text-teal-700 underline">
                          Voir
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-500">Aucun destinataire éligible pour le moment.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Historique des éditions" />
        <div className="overflow-x-auto p-5">
          {stats.campaigns.length ? (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Édition</th>
                  <th className="py-2 pr-3">Statut</th>
                  <th className="py-2 pr-3">Destinataires</th>
                  <th className="py-2 pr-3">Envoyés</th>
                  <th className="py-2 pr-3">Échecs</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {stats.campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3">{c.edition_date.split("-").reverse().join("/")}</td>
                    <td className="py-2 pr-3">{KIND_LABELS[c.kind]}</td>
                    <td className="py-2 pr-3">
                      {STATUS_LABELS[c.status] ?? c.status}
                      {c.note && <span className="block text-xs text-slate-500">{c.note}</span>}
                    </td>
                    <td className="py-2 pr-3">{c.recipients}</td>
                    <td className="py-2 pr-3">{c.sent}</td>
                    <td className="py-2 pr-3">{c.failed}</td>
                    <td className="py-2">
                      {(c.status === "SENDING" || c.status === "PAUSED") && (
                        <form action={setVeilleCampaignStatus} className="flex gap-2">
                          <input type="hidden" name="id" value={c.id} />
                          <button name="status" value={c.status === "SENDING" ? "PAUSED" : "SENDING"} className="text-teal-700 underline">
                            {c.status === "SENDING" ? "Suspendre" : "Reprendre"}
                          </button>
                          <button name="status" value="CANCELLED" className="text-red-700 underline">
                            Annuler
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-500">Aucune édition pour le moment.</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Opportunités les plus consultées depuis les e-mails" />
        <div className="p-5">
          {stats.topOpportunities.length ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {stats.topOpportunities.map((o) => (
                <li key={o.id}>
                  <Link href={`/opportunites/${o.id}`} className="text-navy underline">
                    {o.title}
                  </Link>{" "}
                  — {o.n} clic(s)
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">Aucun clic enregistré pour le moment.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
