import Image from "next/image";
import type { ReactNode } from "react";

/**
 * En-tête commun des pages publiques : fond clair quadrillé, halos animés,
 * titre qui apparaît en douceur et, si fourni, une photo d'illustration (licence libre).
 */
export function PageHero({
  eyebrow,
  title,
  intro,
  image,
  children,
  compact = false,
  before,
}: {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  /** Chemin d'une photo de public/images (décorative) */
  image?: string;
  children?: ReactNode;
  compact?: boolean;
  /** Contenu placé au-dessus du titre (fil d'Ariane…) */
  before?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-slate-200 bg-gradient-to-b from-sky via-white to-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-tech-grid-light absolute inset-0" />
        <div className="absolute -top-32 right-0 size-96 animate-aurora rounded-full bg-teal/15 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 size-80 animate-aurora rounded-full bg-electric/10 blur-3xl [animation-delay:-8s]" />
      </div>
      <div className={`container-page grid items-center gap-8 ${compact ? "py-8 sm:py-10" : "py-10 sm:py-14"} ${image ? "lg:grid-cols-[1.2fr_0.8fr]" : ""}`}>
        <div className="min-w-0">
          {before}
          {eyebrow && <p className="animate-rise text-sm font-semibold tracking-wide text-teal-700 uppercase">{eyebrow}</p>}
          <h1 className={`mt-2 animate-rise font-extrabold [animation-delay:80ms] ${compact ? "text-3xl sm:text-4xl" : "text-3xl sm:text-5xl"}`}>{title}</h1>
          {intro && <div className="mt-3 max-w-3xl animate-rise text-base text-slate-700 [animation-delay:200ms] sm:text-lg">{intro}</div>}
          {children && <div className="mt-5 animate-rise [animation-delay:320ms]">{children}</div>}
        </div>
        {image && (
          <div className="relative hidden animate-pop [animation-delay:250ms] lg:block">
            <div aria-hidden className="absolute -inset-3 rotate-2 rounded-[2rem] bg-gradient-to-br from-teal/30 via-glow/20 to-electric/20 blur-xl" />
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-xl ring-1 ring-slate-200">
              <Image src={image} alt="" fill unoptimized sizes="35vw" className="object-cover transition duration-700 hover:scale-105" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
