import type { ReactNode } from "react";
import { Notice } from "@/components/ui/notice";
import { PageHero } from "@/components/layout/page-hero";

export function ContentPage({
  title,
  intro,
  children,
  legalDraft = false,
  updated,
  dateLabel = "Dernière mise à jour",
  image,
  eyebrow,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  legalDraft?: boolean;
  updated?: string;
  dateLabel?: string;
  /** Photo d'illustration de l'en-tête */
  image?: string;
  eyebrow?: string;
}) {
  return (
    <>
      <PageHero title={title} intro={intro} image={image} eyebrow={eyebrow} compact={!image}>
        {updated && (
          <p className="text-sm text-slate-600">
            {dateLabel} : {updated}
          </p>
        )}
      </PageHero>
      <div className="container-page max-w-3xl py-10 sm:py-14">
        {legalDraft && (
          <Notice tone="warning" className="mb-6" title="Document de travail — à faire valider">
            Ce texte est un modèle. Les éléments entre crochets doivent être complétés, et l&apos;ensemble doit être validé par un
            professionnel du droit (et, si nécessaire, un DPO) avant la mise en production.
          </Notice>
        )}
        <div className="prose-content text-[15px] text-slate-700">{children}</div>
      </div>
    </>
  );
}
