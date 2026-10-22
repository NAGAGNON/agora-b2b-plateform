"use client";

import { useActionState, useEffect, useState } from "react";
import { removeCompanyLogo, updateCompanyLogo } from "@/app/actions/company";
import { CompanyLogo } from "@/components/companies/company-logo";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { ALLOWED_LOGO_TYPES } from "@/lib/constants";

/** Logo de l'entreprise : aperçu immédiat, enregistrement, remplacement et retrait. */
export function LogoForm({ name, path, auto = false }: { name: string; path: string | null; auto?: boolean }) {
  const [state, save] = useActionState(updateCompanyLogo, null);
  const [removed, remove] = useActionState(removeCompanyLogo, null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start" data-testid="logo-form">
      <div className="shrink-0">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local du fichier choisi
          <img src={preview} alt="Aperçu du nouveau logo" width={96} height={96} className="size-24 rounded-xl border border-slate-200 bg-white object-contain" />
        ) : (
          <CompanyLogo name={name} path={path} size={96} />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-sm text-slate-600">
          Votre logo s&apos;affiche sur votre fiche, dans l&apos;annuaire des entreprises et sur les opportunités que vous publiez. Une entreprise avec un logo
          inspire davantage confiance.
        </p>
        <form action={save} className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="logo-file">
            Fichier du logo
          </label>
          <input
            id="logo-file"
            name="logo"
            type="file"
            required
            accept={ALLOWED_LOGO_TYPES.join(",")}
            className="max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-sky file:px-3 file:py-2 file:font-semibold file:text-navy"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
          />
          <SubmitButton size="sm" pendingLabel="Envoi…">
            {path ? "Remplacer le logo" : "Enregistrer le logo"}
          </SubmitButton>
        </form>
        {auto && path && !preview && (
          <p className="text-sm text-slate-600">Ce logo a été repris automatiquement de votre site internet. S&apos;il ne vous convient pas, remplacez-le ou retirez-le.</p>
        )}
        <p className="text-xs text-slate-500">PNG, JPEG ou WebP, 2 Mo maximum. Un logo carré sur fond clair donne le meilleur rendu.</p>
        {path && (
          <form action={remove}>
            <SubmitButton size="sm" variant="outline" pendingLabel="Retrait…">
              Retirer le logo
            </SubmitButton>
          </form>
        )}
        {[state, removed].map((r, i) => r && <Notice key={i} tone={r.ok ? "success" : "error"}>{r.ok ? r.message : r.error}</Notice>)}
      </div>
    </div>
  );
}
