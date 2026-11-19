"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

/** Formulaire de campagne : ouvert d'office pour une première campagne, sinon derrière un seul bouton. */
export function NewCampaign({ open: initial, children }: { open: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(initial);
  if (open) return <section aria-label="Nouvelle campagne">{children}</section>;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-navy px-6 py-4 font-bold text-white shadow-lg transition hover:-translate-y-px"
      data-testid="new-campaign"
    >
      <Plus className="size-5" aria-hidden /> Lancer une nouvelle campagne
    </button>
  );
}
