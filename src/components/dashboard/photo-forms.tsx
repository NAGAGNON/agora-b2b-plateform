"use client";

import { useActionState, useEffect, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { removeAvatar, updateAvatar, addCompanyPhotos, removeCompanyPhoto } from "@/app/actions/photos";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { ALLOWED_LOGO_TYPES } from "@/lib/constants";
import { initials } from "@/lib/format";
import { compressInput } from "@/lib/image-compress";

const fileInput =
  "max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-sky file:px-3 file:py-2 file:font-semibold file:text-navy";

/** Photo de profil : aperçu immédiat, enregistrement, remplacement et retrait. */
export function AvatarForm({ name, url }: { name: string; url: string | null }) {
  const [state, save] = useActionState(updateAvatar, null);
  const [removed, remove] = useActionState(removeAvatar, null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const shown = preview ?? url;
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start" data-testid="avatar-form">
      <div className="shrink-0">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- photo servie par /api/photos ou aperçu local
          <img src={shown} alt={preview ? "Aperçu de la nouvelle photo" : "Votre photo de profil"} width={96} height={96} className="size-24 rounded-full border border-slate-200 bg-white object-cover" />
        ) : (
          <span className="flex size-24 items-center justify-center rounded-full bg-navy text-2xl font-bold text-white">{initials(name)}</span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-sm text-slate-600">Votre photo apparaît dans vos échanges avec les autres entreprises : un visage inspire confiance.</p>
        <form action={save} className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="avatar-file">
            Fichier de la photo
          </label>
          <input
            id="avatar-file"
            name="photo"
            type="file"
            required
            accept={ALLOWED_LOGO_TYPES.join(",")}
            className={fileInput}
            onChange={async (e) => {
              const [f] = await compressInput(e.currentTarget, 1);
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
          />
          <SubmitButton size="sm" pendingLabel="Envoi…">
            {url ? "Remplacer la photo" : "Enregistrer la photo"}
          </SubmitButton>
        </form>
        <p className="text-xs text-slate-500">PNG, JPEG ou WebP, 2 Mo maximum. Une photo carrée, visage bien visible.</p>
        {url && (
          <form action={remove}>
            <SubmitButton size="sm" variant="outline" pendingLabel="Retrait…">
              Retirer la photo
            </SubmitButton>
          </form>
        )}
        {[state, removed].map((r, i) => r && <Notice key={i} tone={r.ok ? "success" : "error"}>{r.ok ? r.message : r.error}</Notice>)}
      </div>
    </div>
  );
}

function RemovePhoto({ id }: { id: string }) {
  const [state, action] = useActionState(removeCompanyPhoto, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="outline" pendingLabel="Retrait…" aria-label="Retirer cette photo">
        <Trash2 className="size-4" aria-hidden /> Retirer
      </SubmitButton>
      {state && !state.ok && <p className="mt-1 text-xs text-red-700">{state.error}</p>}
    </form>
  );
}

/** Photos des prestations : jusqu'à 8 images (réalisations, chantiers, équipe, produits). */
export function CompanyPhotosForm({ photos, max }: { photos: { id: string; url: string; caption: string | null }[]; max: number }) {
  const [state, add] = useActionState(addCompanyPhotos, null);
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p)), [previews]);
  const room = max - photos.length;
  return (
    <div className="space-y-5" data-testid="company-photos-form">
      <p className="text-sm text-slate-600">
        Montrez vos réalisations : chantiers, produits, ateliers, équipe. Les photos s&apos;affichent sur votre fiche publique et rendent votre entreprise plus
        crédible auprès des acheteurs.
      </p>
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- photo servie par /api/photos */}
              <img src={p.url} alt={p.caption ?? "Photo de prestation"} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <div className="space-y-2 p-2">
                {p.caption && <p className="line-clamp-2 text-xs text-slate-600">{p.caption}</p>}
                <RemovePhoto id={p.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {room > 0 ? (
        <form action={add} className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <label htmlFor="company-photos" className="flex items-center gap-2 text-sm font-semibold text-navy">
            <ImagePlus className="size-4 text-teal-700" aria-hidden /> Ajouter des photos ({room} restante{room > 1 ? "s" : ""})
          </label>
          <input
            id="company-photos"
            name="photos"
            type="file"
            multiple
            required
            accept={ALLOWED_LOGO_TYPES.join(",")}
            className={fileInput}
            onChange={async (e) => {
              // Au plus 4 photos par envoi (limite de taille d'un envoi), réduites avant l'envoi
              const files = await compressInput(e.currentTarget, Math.min(room, 4));
              setPreviews(files.map((f) => URL.createObjectURL(f)));
            }}
          />
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {previews.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element -- aperçu local du fichier choisi
                <img key={p} src={p} alt="Aperçu" className="size-20 rounded-lg border border-slate-200 object-cover" />
              ))}
            </div>
          )}
          <div>
            <label htmlFor="photo-caption" className="text-sm text-slate-700">
              Légende (facultatif)
            </label>
            <input id="photo-caption" name="caption" maxLength={120} placeholder="Ex. : Rénovation de toiture, Lyon 2026" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <SubmitButton size="sm" pendingLabel="Envoi…">
            Enregistrer les photos
          </SubmitButton>
          <p className="text-xs text-slate-500">PNG, JPEG ou WebP. Jusqu&apos;à 4 photos par envoi, {max} au total. Les photos sont allégées automatiquement.</p>
        </form>
      ) : (
        <Notice tone="info">Vous avez atteint {max} photos. Retirez-en une pour en ajouter une nouvelle.</Notice>
      )}
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>}
    </div>
  );
}
