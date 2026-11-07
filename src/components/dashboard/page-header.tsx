import Image from "next/image";
import type { ReactNode } from "react";

/**
 * En-tête des pages de l'espace membre : icône animée, titre, description, action et petite
 * illustration (décorative). Même présentation sur toutes les pages pour s'y retrouver d'un coup d'œil.
 */
export function DashboardPageHeader({
  title,
  description,
  icon,
  image,
  action,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon: ReactNode;
  image?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="relative isolate mb-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-sky/80 via-white to-white" />
        <div className="absolute -top-20 right-1/3 size-56 animate-aurora rounded-full bg-teal/15 blur-3xl" />
        {image && (
          <div className="absolute inset-y-0 right-0 hidden w-1/2 opacity-90 [mask-image:linear-gradient(to_right,transparent,black_70%)] sm:block">
            <Image src={image} alt="" fill unoptimized sizes="35vw" className="object-cover" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-4">
          <span className="flex size-12 shrink-0 animate-pop items-center justify-center rounded-2xl bg-gradient-to-br from-navy to-navy-900 text-teal-300 shadow-lg ring-1 ring-white/10 [&>svg]:size-6">
            {icon}
          </span>
          <div className="min-w-0">
            <h1 className="animate-rise text-2xl font-extrabold text-navy sm:text-3xl">{title}</h1>
            {description && <div className="mt-1 max-w-2xl animate-rise text-sm text-slate-600 [animation-delay:80ms]">{description}</div>}
          </div>
        </div>
        {action && <div className="relative flex shrink-0 flex-wrap gap-2">{action}</div>}
      </div>
      {children && <div className="border-t border-slate-100 bg-white/70 px-5 py-4 backdrop-blur sm:px-6">{children}</div>}
    </header>
  );
}
