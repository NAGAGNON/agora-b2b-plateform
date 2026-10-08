"use client";

import { Sparkles, ThumbsDown, ThumbsUp, Cog, Lightbulb, Mail } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardHeader } from "@/components/ui/card";
import { emailDailyReport, refreshDailyReport } from "@/app/actions/daily-report";

export type DailyReportRow = {
  day: string;
  generated_at: string;
  summary: {
    titre: string;
    resume: string;
    points_forts: { domaine: string; constat: string }[];
    points_faibles: { domaine: string; constat: string }[];
    automatique: { domaine: string; bilan: string }[];
    recommandations: string[];
  } | null;
  note: string | null;
  error: string | null;
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

function Items({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: { label: string; text: string }[];
  tone: string;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className={`mb-2 flex items-center gap-2 text-sm font-bold ${tone}`}>
        {icon} {title}
      </h3>
      <ul className="space-y-2 text-sm">
        {items.map((i, n) => (
          <li key={n} className="rounded-lg bg-slate-50 px-3 py-2">
            {i.label && (
              <span className="font-semibold text-navy">{i.label} · </span>
            )}
            {i.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Bilan du jour : ce qui s'est passé, ce qui a marché, ce que les tâches automatiques ont fait. */
export function DailyReportCard({
  report,
  history,
}: {
  report: DailyReportRow | null;
  history: DailyReportRow[];
}) {
  const s = report?.summary;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="size-5 text-teal-700" aria-hidden /> Bilan du
            jour
          </span>
        }
        description={
          report
            ? `Analyse du ${when(report.generated_at)} — rédigée à partir des chiffres réels ci-dessous. Mise à jour automatique une fois par jour, à 21 h, avec le rapport complet envoyé par e-mail.`
            : "Aucun bilan encore : lancez la première analyse."
        }
        action={
          <div className="flex flex-wrap gap-2">
            <ActionForm action={refreshDailyReport} hidden={{}}>
              <SubmitButton
                variant="outline"
                pendingLabel="Analyse en cours (environ 30 s)…"
              >
                <Sparkles className="size-4" aria-hidden /> Analyser maintenant
              </SubmitButton>
            </ActionForm>
            <ActionForm action={emailDailyReport} hidden={{}}>
              <SubmitButton
                variant="outline"
                pendingLabel="Préparation du rapport (environ 30 s)…"
              >
                <Mail className="size-4" aria-hidden /> Recevoir le rapport par
                e-mail
              </SubmitButton>
            </ActionForm>
          </div>
        }
      />
      {(report || history.length > 0) && (
        <div className="space-y-5 p-5">
          {report?.error && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {report.error}
            </p>
          )}
          {s && (
            <>
              <div>
                <p className="font-heading text-lg font-bold text-navy">
                  {s.titre}
                </p>
                <p className="mt-1 text-slate-700">{s.resume}</p>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <Items
                  icon={<ThumbsUp className="size-4" aria-hidden />}
                  title="Ce qui a bien marché"
                  tone="text-teal-800"
                  items={s.points_forts.map((p) => ({
                    label: p.domaine,
                    text: p.constat,
                  }))}
                />
                <Items
                  icon={<ThumbsDown className="size-4" aria-hidden />}
                  title="Ce qui a moins marché / à surveiller"
                  tone="text-amber-800"
                  items={s.points_faibles.map((p) => ({
                    label: p.domaine,
                    text: p.constat,
                  }))}
                />
              </div>
              <Items
                icon={<Cog className="size-4" aria-hidden />}
                title="Ce que les tâches automatiques ont fait aujourd'hui"
                tone="text-navy"
                items={s.automatique.map((a) => ({
                  label: a.domaine,
                  text: a.bilan,
                }))}
              />
              <Items
                icon={<Lightbulb className="size-4" aria-hidden />}
                title="Recommandations"
                tone="text-navy"
                items={s.recommandations.map((r) => ({ label: "", text: r }))}
              />
              {report?.note && (
                <p className="text-xs text-amber-800">{report.note}</p>
              )}
            </>
          )}
          {history.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-navy">
                Bilans des jours précédents
              </summary>
              <ul className="mt-2 space-y-2">
                {history.map((h) => (
                  <li
                    key={h.day}
                    className="rounded-lg border border-slate-100 px-3 py-2"
                  >
                    <span className="font-semibold">
                      {new Intl.DateTimeFormat("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        timeZone: "UTC",
                      }).format(new Date(h.day))}
                    </span>
                    {h.summary
                      ? ` — ${h.summary.titre} ${h.summary.resume}`
                      : " — chiffres uniquement"}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
