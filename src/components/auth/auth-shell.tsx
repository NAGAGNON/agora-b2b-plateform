import type { ReactNode } from "react";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

/** Mise en page des écrans d'authentification (formulaire + argumentaire). */
export function AuthShell({ title, subtitle, children, footer, aside = true }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; aside?: boolean }) {
  return (
    <div className={`container-page grid gap-10 py-10 sm:py-16 ${aside ? "lg:grid-cols-2 lg:items-start" : ""}`}>
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <div className="mt-2 text-slate-600">{subtitle}</div>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">{footer}</div>}
      </div>
      {aside && (
        <div className="relative isolate hidden overflow-hidden rounded-3xl bg-navy-900 p-10 text-white shadow-2xl lg:block">
          <Image src="/images/illustrations/accord.webp" alt="" fill unoptimized sizes="45vw" className="-z-20 object-cover" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-900 via-navy-900/90 to-navy-900/60" />
          <div aria-hidden className="absolute -right-20 -bottom-20 -z-10 size-72 animate-aurora rounded-full bg-teal/30 blur-3xl" />
          <p className="pt-40 font-heading text-2xl font-bold text-white">Les bonnes opportunités. Les bons partenaires. Au bon moment.</p>
          <ul className="mt-8 space-y-4 text-slate-200">
            {[
              "Consultez les besoins d'entreprises et les opportunités référencées",
              "Publiez un besoin, une demande de devis ou un appel d'offres privé",
              "Recevez des alertes selon vos secteurs et votre zone",
              "Suivez vos opportunités dans un pipeline privé",
              "Inscription gratuite — sans carte bancaire",
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
