import type { ReactNode } from "react";
import { Notice } from "@/components/ui/notice";

export function ContentPage({ title, intro, children, legalDraft = false, updated }: { title: string; intro?: ReactNode; children: ReactNode; legalDraft?: boolean; updated?: string }) {
  return (
    <div className="container-page max-w-3xl py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      {intro && <div className="mt-3 text-lg text-slate-600">{intro}</div>}
      {updated && <p className="mt-2 text-sm text-slate-500">Dernière mise à jour : {updated}</p>}
      {legalDraft && (
        <Notice tone="warning" className="mt-6" title="Document de travail — à faire valider">
          Ce texte est un modèle préparé pour la phase pilote. Les éléments entre crochets doivent être complétés, et l&apos;ensemble doit être validé par un
          professionnel du droit (et, si nécessaire, un DPO) avant la mise en production.
        </Notice>
      )}
      <div className="prose-content mt-8 text-[15px] text-slate-700">{children}</div>
    </div>
  );
}
