"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { joinFounderList } from "@/app/actions/founder-list";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";

const GAINS = [
  "Les appels d'offres de votre métier chaque matin, sans limite",
  "Une fiche claire pour chaque appel d'offres : l'essentiel, les documents à fournir, les dates",
  "Le suivi de vos candidatures et leur résultat surveillé pour vous, prévenu par e-mail",
  "Les besoins des entreprises avant tout le monde",
];

/**
 * Bouton « Je veux le tarif fondateur » : au clic, une fenêtre explique le principe et le prix,
 * puis le membre confirme. Aucun paiement, aucune carte bancaire, aucun engagement.
 */
export function FounderJoinButton({ joined, price, regular, className }: { joined: boolean; price: string; regular: string; className?: string }) {
  const [done, setDone] = useState(joined);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done)
    return (
      <p className={cn("inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20", className)} data-testid="founder-joined">
        <Check className="size-4 text-teal-400" aria-hidden /> Vous êtes sur la liste
      </p>
    );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal to-electric px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal/20 hover:opacity-95", className)}
        data-testid="founder-join"
      >
        Je veux ce prix
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Le tarif fondateur, en 3 points">
        <div className="space-y-5 text-sm text-slate-700" data-testid="founder-explain">
          <ol className="space-y-3">
            {[
              ["Aujourd'hui", "Tout est gratuit, jusqu'au vrai lancement du site."],
              ["Au lancement", `L'offre Pro coûtera ${regular} HT par mois.`],
              ["Vous, sur la liste", `Vous la paierez ${price} HT par mois pendant les 3 premiers mois.`],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal to-electric text-sm font-bold text-white">{i + 1}</span>
                <span>
                  <strong className="block text-navy">{t}</strong>
                  {d}
                </span>
              </li>
            ))}
          </ol>
          <div className="rounded-2xl bg-sky p-4">
            <p className="font-semibold text-navy">Avec l&apos;offre Pro, vous avez :</p>
            <ul className="mt-2 space-y-1.5">
              {GAINS.map((g) => (
                <li key={g} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden />
                  {g}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-center text-xs text-slate-500"><strong className="block text-sm text-navy">S&apos;inscrire sur la liste ne vous engage à rien.</strong>Rien à payer aujourd&apos;hui · Pas de carte bancaire · Vous déciderez librement au lancement</p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await joinFounderList();
                if (r.ok) {
                  setDone(true);
                  setOpen(false);
                } else setError(r.error ?? "Réessayez dans un instant.");
              })
            }
            className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-teal to-electric px-4 py-3 text-base font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
            data-testid="founder-confirm"
          >
            {pending ? "Un instant…" : "Je m'inscris sur la liste"}
          </button>
          {error && <p className="text-center text-xs text-red-700">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
