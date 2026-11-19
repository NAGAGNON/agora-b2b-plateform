import { PREVIEW_SANDBOX, previewHtml } from "@/lib/email-preview";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { emailCatalog } from "@/lib/email/catalog";
import { renderEmail } from "@/lib/email/templates";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { EmailCheck } from "@/components/admin/email-check";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const DAY = 86_400_000;
const nowMs = () => Date.now();
const PERIODS = [
  { key: "24h", label: "24 h", days: 1 },
  { key: "7j", label: "7 jours", days: 7 },
  { key: "30j", label: "30 jours", days: 30 },
] as const;
const STATUS: Record<string, { label: string; cls: string }> = {
  SENT: { label: "Envoyé", cls: "bg-teal-50 text-teal-800 ring-teal/20" },
  PENDING: {
    label: "En attente",
    cls: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  SENDING: {
    label: "En cours",
    cls: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  FAILED: { label: "Échec", cls: "bg-red-50 text-red-700 ring-red-200" },
  SKIPPED: {
    label: "Non envoyé",
    cls: "bg-slate-100 text-slate-500 ring-slate-200",
  },
};

export const metadata = { title: "E-mails" };

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; statut?: string }>;
}) {
  await requireAdmin();
  const transport = env.emailTransport;
  const items = emailCatalog();
  const sp = await searchParams;
  const period = PERIODS.find((p) => p.key === sp.periode) ?? PERIODS[0];
  const statut = sp.statut && STATUS[sp.statut] ? sp.statut : null;
  const since = new Date(nowMs() - period.days * DAY).toISOString();
  const db = createAdminClient();
  let outboxQ = db
    .from("email_outbox")
    .select(
      "id, to_email, template, subject, status, last_error, sent_at, created_at",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  let veilleQ = db
    .from("veille_sends")
    .select(
      "id, email, subject, status, error, sent_at, created_at, opened_at, clicked_at",
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(500);
  if (statut) {
    outboxQ = outboxQ.eq("status", statut as "SENT");
    veilleQ = veilleQ.eq("status", statut);
  }
  const [{ data: outbox }, { data: veille }] = await Promise.all([
    outboxQ,
    veilleQ,
  ]);
  const labels = new Map(items.map((e) => [e.key, e.label]));
  const log = [
    ...(outbox ?? []).map((e) => ({
      id: e.id,
      to: e.to_email,
      kind: labels.get(e.template) ?? e.template,
      subject: e.subject,
      status: e.status as string,
      error: e.last_error,
      at: e.sent_at ?? e.created_at,
      seen: null as string | null,
    })),
    ...(veille ?? []).map((e) => ({
      id: e.id,
      to: e.email,
      kind: "Veille du matin",
      subject: e.subject ?? "Veille commerciale",
      status: e.status as string,
      error: e.error,
      at: e.sent_at ?? e.created_at,
      seen: e.clicked_at ? "a cliqué" : e.opened_at ? "a ouvert" : null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const count = (st: string) => log.filter((l) => l.status === st).length;
  const href = (p: string, st: string | null) =>
    `/admin/emails?periode=${p}${st ? `&statut=${st}` : ""}`;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          E-mails envoyés par la plateforme
        </h1>
        <p className="mt-1 text-slate-600">
          {items.length} modèles, en HTML et en texte, aux couleurs de
          LinkProB2B. Contenus d&apos;exemple ci-dessous.
        </p>
      </div>
      <Notice
        tone={
          transport === "smtp" || transport === "resend" ? "success" : "info"
        }
      >
        Transport actuel :{" "}
        {transport === "smtp"
          ? `SMTP du domaine (${process.env.SMTP_HOST}) — aucun coût par e-mail`
          : transport === "resend"
            ? `Resend, depuis ${env.resendFrom}${env.smtpConfigured ? " — Gmail (SMTP) en secours si Resend refuse un envoi" : ""}`
            : transport === "mailpit"
              ? "boîte de test (aucun e-mail ne sort)"
              : "aucun — renseignez le serveur SMTP du domaine (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)"}{" "}
        {transport !== "resend" && <> · expéditeur {env.emailFrom}</>}
      </Notice>

      <section
        className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        aria-labelledby="journal"
        data-testid="email-log"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="journal" className="font-heading text-xl font-bold text-navy">
            Journal des envois
          </h2>
          <nav
            aria-label="Période"
            className="inline-flex rounded-2xl bg-slate-100 p-1"
          >
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={href(p.key, statut)}
                aria-current={p.key === period.key ? "page" : undefined}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-sm font-semibold",
                  p.key === period.key
                    ? "bg-white text-navy shadow"
                    : "text-slate-600 hover:text-navy",
                )}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link
            href={href(period.key, null)}
            className={cn(
              "rounded-full px-3 py-1 font-semibold ring-1",
              !statut
                ? "bg-navy text-white ring-navy"
                : "ring-slate-200 hover:bg-slate-50",
            )}
          >
            Tous ({log.length})
          </Link>
          {(["SENT", "PENDING", "FAILED"] as const).map((st) => (
            <Link
              key={st}
              href={href(period.key, st)}
              className={cn(
                "rounded-full px-3 py-1 font-semibold ring-1",
                statut === st
                  ? "bg-navy text-white ring-navy"
                  : "ring-slate-200 hover:bg-slate-50",
              )}
            >
              {STATUS[st].label} ({statut && statut !== st ? "…" : count(st)})
            </Link>
          ))}
        </p>
        {log.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-slate-600">
            Aucun e-mail sur cette période.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {log.slice(0, 300).map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5 text-sm"
              >
                <span className="w-32 shrink-0 text-slate-500 tabular-nums">
                  {formatDateTime(l.at)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-navy">
                    {l.subject}
                  </span>
                  <span className="block text-slate-600">
                    {l.kind} · à {l.to}
                    {l.seen && (
                      <span className="ml-1 font-semibold text-teal-700">
                        · {l.seen}
                      </span>
                    )}
                  </span>
                  {l.error && l.status !== "SENT" && (
                    <span className="block text-xs text-red-700">
                      {l.error.slice(0, 200)}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ring-1",
                    STATUS[l.status]?.cls ?? STATUS.PENDING.cls,
                  )}
                >
                  {STATUS[l.status]?.label ?? l.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        {log.length > 300 && (
          <p className="mt-2 text-sm text-slate-500">
            … les 300 plus récents sont affichés.
          </p>
        )}
      </section>

      <EmailCheck enabled={Boolean(transport)} />
      <details className="rounded-3xl border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer font-heading text-lg font-bold text-navy">
          Voir les modèles d&apos;e-mails ({items.length})
        </summary>
        <ul className="mt-4 grid gap-6 lg:grid-cols-2">
          {items.map((e) => {
            const { html } = renderEmail(e.layout);
            return (
              <li
                key={e.key}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="space-y-1 border-b border-slate-100 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-navy">{e.label}</p>
                    <Badge tone="slate">{e.key}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Déclencheur : {e.trigger}
                  </p>
                  <p className="text-sm text-slate-700">Objet : {e.subject}</p>
                </div>
                <iframe
                  title={`Aperçu : ${e.label}`}
                  srcDoc={previewHtml(html)}
                  sandbox={PREVIEW_SANDBOX}
                  className="h-96 w-full border-0 bg-sky"
                />
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}
