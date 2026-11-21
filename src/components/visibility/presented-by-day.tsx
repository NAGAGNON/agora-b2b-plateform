import Link from "next/link";
import { Building2, Mail, MousePointerClick } from "lucide-react";
import type { Presented } from "@/lib/visibility-report";
import { cn } from "@/lib/cn";

const DAY = 86_400_000;
export const parisDay = (d: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(d));
const STATE: Record<Presented["state"], { label: string; style: string }> = {
  presented: { label: "Vue dans son espace", style: "bg-slate-100 text-slate-700" },
  sent: { label: "E-mail envoyé", style: "bg-sky text-navy" },
  read: { label: "A lu", style: "bg-teal-50 text-teal-800 ring-1 ring-teal-200" },
  clicked: { label: "A ouvert la fiche", style: "bg-teal text-navy" },
};

/** À qui la campagne a présenté l'entreprise, jour par jour (7 derniers jours), avec l'état de chaque présentation. */
export function PresentedByDay({ presented, startsAt, basePath, day: wanted, now, emptyToday }: { presented: Presented[]; startsAt: string | null; basePath: string; day?: string; now: number; emptyToday: string }) {
  const today = parisDay(new Date(now));
  const yesterday = parisDay(new Date(now - DAY));
  const start = startsAt ? parisDay(startsAt) : today;
  const days = Array.from({ length: 7 }, (_, i) => parisDay(new Date(now - i * DAY))).filter((d) => d >= start);
  const day = wanted && days.includes(wanted) ? wanted : today;
  const ofDay = presented.filter((p) => parisDay(p.at) === day);
  const label = (iso: string) =>
    iso === today ? "Aujourd'hui" : iso === yesterday ? "Hier" : new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return (
    <>
      {days.length > 1 && (
        <nav className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Choisir le jour">
          {days.map((d) => {
            const n = presented.filter((p) => parisDay(p.at) === d).length;
            return (
              <Link
                key={d}
                href={d === today ? basePath : `${basePath}?jour=${d}`}
                scroll={false}
                aria-current={d === day ? "page" : undefined}
                className={cn("shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition", d === day ? "bg-navy text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}
              >
                {label(d)} <span className={cn("tabular-nums", d === day ? "text-teal-300" : "text-slate-500")}>· {n}</span>
              </Link>
            );
          })}
        </nav>
      )}
      {ofDay.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600" data-testid="day-empty">
          {day === today ? emptyToday : "Aucune présentation ce jour-là."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100" data-testid="day-list">
          {ofDay.map((p, i) => (
            <li key={`${p.name}-${i}`} className="flex items-center gap-3 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky text-navy" aria-hidden>
                {p.channel === "PROSPECT" ? <Mail className="size-5" /> : <Building2 className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold break-words text-navy">{p.name}</p>
                <p className="text-xs text-slate-500">{[p.city, p.channel === "PROSPECT" ? "par e-mail" : "dans son espace LinkProB2B"].filter(Boolean).join(" · ")}</p>
                <span className={cn("mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold sm:hidden", STATE[p.state].style)}>
                  {p.state === "clicked" && <MousePointerClick className="size-3.5" aria-hidden />}
                  {STATE[p.state].label}
                </span>
              </div>
              <span className={cn("hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold sm:inline-flex", STATE[p.state].style)}>
                {p.state === "clicked" && <MousePointerClick className="size-3.5" aria-hidden />}
                {STATE[p.state].label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
