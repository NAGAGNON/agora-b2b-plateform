import { Check } from "lucide-react";
import { STEP_SHORT } from "@/lib/application-plan";
import { cn } from "@/lib/cn";

/**
 * Barre de progression d'une candidature : « Votre candidature avance · 3/6 étapes terminées », les six
 * étapes nommées, l'étape en cours mise en avant. Version complète (dossier) ou compacte (liste).
 */
export function StepsProgress({ done, sent = false, compact = false, title = "Votre candidature avance" }: { done: number[]; sent?: boolean; compact?: boolean; title?: string }) {
  const finished = sent ? STEP_SHORT.length : done.length;
  const current = sent ? -1 : STEP_SHORT.findIndex((_, i) => !done.includes(i));
  const pct = Math.round((finished / STEP_SHORT.length) * 100);
  return (
    <div className={cn(!compact && "rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6")} data-testid="steps-progress">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {!compact && <p className="font-heading text-lg font-bold text-navy">{sent ? "Réponse déposée" : finished === 0 ? "Votre candidature commence" : title}</p>}
        <p className={cn("font-semibold text-navy tabular-nums", compact ? "text-sm" : "text-base")}>
          <span className={cn("font-heading font-extrabold", compact ? "text-base" : "text-2xl")}>
            {finished}/{STEP_SHORT.length}
          </span>{" "}
          <span className="font-medium text-slate-500">étapes terminées</span>
        </p>
      </div>
      {/* Six segments, un par étape */}
      <ol className={cn("grid grid-cols-6 gap-1.5", compact ? "mt-2" : "mt-4")} aria-label={`${finished} étapes terminées sur ${STEP_SHORT.length}`}>
        {STEP_SHORT.map((label, i) => {
          const ok = sent || done.includes(i);
          const now = i === current;
          return (
            <li key={label} className="min-w-0">
              <div
                className={cn(
                  "overflow-hidden rounded-full transition-all duration-700",
                  compact ? "h-2" : "h-3",
                  ok ? "bg-gradient-to-r from-teal to-electric" : now ? "bg-teal/25 ring-2 ring-teal/60" : "bg-slate-100",
                )}
              >
                {now && <div className="h-full w-1/3 animate-pulse rounded-full bg-teal/60" />}
              </div>
              {!compact && (
                <p className={cn("mt-2 flex items-center gap-1 text-xs leading-tight", ok ? "font-semibold text-teal-800" : now ? "font-bold text-navy" : "text-slate-400")}>
                  {ok && <Check className="size-3 shrink-0" aria-hidden />}
                  <span className="truncate sm:whitespace-normal">{label}</span>
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {!compact && (
        <p className="mt-4 text-sm text-slate-600">
          {sent
            ? "Toutes les étapes sont faites : il ne reste qu'à attendre le résultat."
            : current >= 0
              ? <>Prochaine étape : <strong className="text-navy">{STEP_SHORT[current]}</strong> · {pct} % du parcours fait</>
              : "Toutes les étapes sont cochées : déposez votre réponse sur la plateforme de l'acheteur."}
        </p>
      )}
    </div>
  );
}
