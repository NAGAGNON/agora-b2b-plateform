import { CalendarCheck, Mail, Sparkles, TrendingDown, TrendingUp, Minus, AlertTriangle } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { emailWeeklyReview, refreshWeeklyReview } from "@/app/actions/daily-report";
import { latestWeeklyReview } from "@/lib/weekly-review";
import { fallbackSummary, frWeek, variation } from "@/lib/weekly-review-core";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const TONE = {
  hausse: { icon: TrendingUp, cls: "bg-teal-50 text-teal-700 ring-teal-200" },
  baisse: { icon: TrendingDown, cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  stable: { icon: Minus, cls: "bg-slate-50 text-slate-600 ring-slate-200" },
  alerte: { icon: AlertTriangle, cls: "bg-orange-50 text-orange-700 ring-orange-200" },
} as const;

/**
 * Analyste du lundi : bilan de la semaine écoulée comparée à la semaine d'avant (constats, actions,
 * chiffres). Préparé et envoyé par e-mail chaque lundi à 8 h ; boutons pour le préparer ou le recevoir.
 */
export async function WeeklyReviewCard() {
  const row = await latestWeeklyReview();
  const s = row ? (row.summary ?? fallbackSummary(row.facts)) : null;
  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200" data-testid="weekly-review">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-br from-teal-50 via-white to-violet-50 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-violet text-white shadow-lg shadow-teal/20">
            <CalendarCheck className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-teal-700 uppercase">Analyste du lundi</p>
            <h2 className="mt-0.5 font-heading text-lg font-bold text-navy sm:text-xl">{s ? s.titre : "Votre bilan de la semaine, chaque lundi à 8 h"}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {row
                ? `Semaine ${frWeek(row.facts.semaine)}, comparée à la semaine ${frWeek(row.facts.precedente)} · préparé le ${formatDateTime(row.generated_at)}${row.emailed_at ? " · envoyé par e-mail" : ""}`
                : "Chaque lundi, les chiffres de la semaine écoulée comparés à la semaine d'avant, avec ce qui monte, ce qui baisse et quoi faire. Aussi envoyé par e-mail."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <ActionForm action={refreshWeeklyReview} hidden={{}}>
            <SubmitButton variant="outline" pendingLabel="Analyse en cours…">
              <Sparkles className="size-4" aria-hidden /> {row ? "Mettre à jour" : "Préparer maintenant"}
            </SubmitButton>
          </ActionForm>
          {row && (
            <ActionForm action={emailWeeklyReview} hidden={{}}>
              <SubmitButton variant="outline" pendingLabel="Envoi…">
                <Mail className="size-4" aria-hidden /> Recevoir par e-mail
              </SubmitButton>
            </ActionForm>
          )}
        </div>
      </div>

      {row && s && (
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-3">
            {s.points.map((p, i) => {
              const t = TONE[p.tendance] ?? TONE.stable;
              const Icon = t.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ring-1", t.cls)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <p className="text-sm leading-relaxed text-slate-700">{p.texte}</p>
                </div>
              );
            })}
            {s.actions.length > 0 && (
              <div className="mt-4 rounded-2xl bg-navy p-4 text-white">
                <p className="text-sm font-bold">À faire cette semaine</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-white/85">
                  {s.actions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ol>
              </div>
            )}
            {row.error && <p className="text-xs text-slate-400">{row.error}</p>}
          </div>
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2 font-medium">Indicateur</th>
                  <th className="pb-2 text-right font-medium">Semaine</th>
                  <th className="pb-2 text-right font-medium">Avant</th>
                  <th className="pb-2 text-right font-medium">Évolution</th>
                </tr>
              </thead>
              <tbody>
                {row.facts.chiffres.map((m) => {
                  const d = m.semaine - m.precedente;
                  const v = variation(m);
                  return (
                    <tr key={m.cle} className="border-t border-slate-100">
                      <td className="py-2 pr-2 text-slate-700">{m.libelle}</td>
                      <td className="py-2 text-right font-heading font-bold text-navy">{m.semaine}</td>
                      <td className="py-2 text-right text-slate-500">{m.precedente}</td>
                      <td className={cn("py-2 text-right font-semibold whitespace-nowrap", d > 0 ? "text-teal-700" : d < 0 ? "text-rose-600" : "text-slate-400")}>
                        {d === 0 ? "=" : `${d > 0 ? "+" : "−"}${Math.abs(d)}${v !== null ? ` (${d > 0 ? "+" : "−"}${Math.abs(v)} %)` : ""}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
