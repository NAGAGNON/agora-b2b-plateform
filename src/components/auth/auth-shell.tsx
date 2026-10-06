import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

/** Mise en page des écrans d'authentification (formulaire + argumentaire). */
export function AuthShell({ title, subtitle, children, aside = true }: { title: string; subtitle?: ReactNode; children: ReactNode; aside?: boolean }) {
  return (
    <div className="container-page grid gap-10 py-10 sm:py-16 lg:grid-cols-2 lg:items-start">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-2 text-slate-600">{subtitle}</div>}
        <div className="mt-8">{children}</div>
      </div>
      {aside && (
        <div className="hidden rounded-3xl bg-navy p-10 text-white lg:block">
          <p className="font-heading text-2xl font-bold text-white">Les bonnes opportunités. Les bons partenaires. Au bon moment.</p>
          <ul className="mt-8 space-y-4 text-slate-200">
            {[
              "Consultez les besoins d'entreprises et les opportunités référencées",
              "Publiez un besoin, une demande de devis ou un appel d'offres privé",
              "Recevez des alertes selon vos secteurs et votre zone",
              "Suivez vos opportunités dans un pipeline privé",
              "Gratuit pendant le pilote — sans carte bancaire",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <CheckCircle2 className="size-5 shrink-0 text-teal" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
