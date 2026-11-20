"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { joinFounderList } from "@/app/actions/founder-list";
import { cn } from "@/lib/cn";

const GAINS = [
  "La veille des appels d'offres sans limite, chaque matin dans votre boîte",
  "La fiche synthèse de chaque appel d'offres : l'essentiel, les pièces à fournir, les dates",
  "Le suivi de vos candidatures étape par étape, avec les rappels",
  "Les besoins des entreprises en avant-première et des alertes illimitées",
];

/**
 * Bouton « Je veux le tarif fondateur ». Au clic : explication du principe et de ce que le membre y
 * gagne, puis confirmation. Aucun paiement, aucune carte bancaire, aucun engagement.
 */
export function FounderJoinButton({ joined, className }: { joined: boolean; className?: string }) {
  const [done, setDone] = useState(joined);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done)
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 ring-1 ring-teal/30", className)} data-testid="founder-joined">
        <Check className="size-4" aria-hidden /> Vous êtes sur la liste
      </span>
    );
  return (
    <span className={cn("inline-flex flex-col gap-2", className)}>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-teal to-electric px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-95"
          data-testid="founder-join"
        >
          Je veux le tarif fondateur
        </button>
      )}
      {open && (
        <span className="block max-w-md rounded-2xl bg-white p-4 text-left text-sm text-slate-700 shadow-lg ring-1 ring-slate-200" data-testid="founder-explain">
          <span className="flex items-start justify-between gap-3">
            <strong className="font-heading text-base text-navy">Le tarif fondateur, comment ça marche ?</strong>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Fermer">
              <X className="size-4" aria-hidden />
            </button>
          </span>
          <span className="mt-2 block">
            Aujourd&apos;hui, tout est gratuit. Bientôt, une offre Pro ouvrira. En rejoignant la liste, vous serez <strong>prévenu en premier</strong> et vous
            aurez un <strong>prix plus léger que le prix public</strong>, réservé aux membres du lancement.
          </span>
          <span className="mt-3 block font-semibold text-navy">Ce que l&apos;offre Pro vous apporte :</span>
          <span className="mt-1 block space-y-1">
            {GAINS.map((g) => (
              <span key={g} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-teal-600" aria-hidden />
                {g}
              </span>
            ))}
          </span>
          <span className="mt-3 block rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            Aucun paiement maintenant, aucune carte bancaire, aucun engagement. Le prix fondateur vous sera annoncé avant l&apos;ouverture, et vous serez libre
            de l&apos;accepter ou non.
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await joinFounderList();
                if (r.ok) setDone(true);
                else setError(r.error ?? "Réessayez dans un instant.");
              })
            }
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-teal to-electric px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
            data-testid="founder-confirm"
          >
            {pending ? "Un instant…" : "Rejoindre la liste"}
          </button>
          {error && <span className="mt-2 block text-xs text-red-700">{error}</span>}
        </span>
      )}
    </span>
  );
}
