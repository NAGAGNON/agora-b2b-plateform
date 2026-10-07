import type { ReactNode } from "react";
import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { relevanceLabel } from "@/lib/outreach/matching";
import { cn } from "@/lib/cn";

const nf = (n: number) => n.toLocaleString("fr-FR");
export const fmtN = nf;
export const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—");

/** Indicateur chiffré (valeur réelle issue de la base). */
export function Stat({ label, value, hint, href, tone = "default" }: { label: string; value: number | string; hint?: ReactNode; href?: string; tone?: "default" | "accent" }) {
  const body = (
    <>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase [overflow-wrap:anywhere] hyphens-auto">{label}</p>
      <p className={cn("mt-1.5 font-heading text-3xl font-bold tabular-nums", tone === "accent" ? "text-teal-700" : "text-navy")}>{typeof value === "number" ? nf(value) : value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );
  const cls = "block rounded-xl border border-slate-200 bg-white p-4 shadow-sm";
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:border-teal")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Panel({ title, description, action, children, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-navy">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHead({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-slate-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const tone: BadgeTone = score >= 85 ? "green" : score >= 70 ? "teal" : score >= 50 ? "amber" : "slate";
  return (
    <Badge tone={tone} className="tabular-nums">
      {score}/100 · {relevanceLabel(score)}
    </Badge>
  );
}

export const CAMPAIGN_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  BUILDING: { label: "En préparation", tone: "slate" },
  READY: { label: "Prévisualisation", tone: "amber" },
  VALIDATED: { label: "Validée", tone: "sky" },
  SENDING: { label: "Envoi en cours", tone: "sky" },
  SENT: { label: "Envoyée", tone: "green" },
  SIMULATED: { label: "Simulée", tone: "violet" },
  CANCELLED: { label: "Annulée", tone: "slate" },
  FAILED: { label: "Échec", tone: "red" },
};

export const RECIPIENT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: "Prêt à envoyer", tone: "teal" },
  QUEUED: { label: "En file d'envoi", tone: "sky" },
  SENT: { label: "Envoyé", tone: "green" },
  SIMULATED: { label: "Simulé", tone: "violet" },
  FAILED: { label: "Échec", tone: "red" },
  EXCLUDED: { label: "Exclu", tone: "slate" },
  NO_EMAIL: { label: "Sans e-mail", tone: "amber" },
  SUPPRESSED: { label: "Ne plus contacter", tone: "red" },
  FREQUENCY: { label: "Déjà sollicitée récemment", tone: "slate" },
};

export const OPP_STATE: Record<string, { label: string; tone: BadgeTone }> = {
  NEW: { label: "Nouvelle", tone: "teal" },
  PROCESSED: { label: "Traitée", tone: "green" },
  MODIFIED: { label: "Modifiée", tone: "amber" },
  EXPIRED: { label: "Expirée", tone: "slate" },
  IGNORED: { label: "Ignorée", tone: "slate" },
};

export const PROSPECT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Active", tone: "green" },
  EXCLUDED: { label: "Exclue", tone: "slate" },
  DO_NOT_CONTACT: { label: "Ne plus contacter", tone: "red" },
  CLOSED: { label: "Fermée", tone: "slate" },
};

export function StatusBadge({ map, status }: { map: Record<string, { label: string; tone: BadgeTone }>; status: string }) {
  const s = map[status] ?? { label: status, tone: "slate" as BadgeTone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
