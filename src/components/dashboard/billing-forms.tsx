"use client";

import Link from "next/link";
import { useActionState } from "react";
import { openBillingPortal, startCheckout } from "@/app/actions/billing";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError } from "@/components/ui/form";
import type { ActionResult } from "@/lib/validation";

/** Souscription : case d'acceptation non pré-cochée, obligatoire, contrôlée aussi côté serveur. */
export function CheckoutForm({ plan, label, variant = "primary" }: { plan: "PRO" | "BUSINESS"; label: string; variant?: "primary" | "secondary" | "outline" }) {
  const [state, action] = useActionState(startCheckout, null as ActionResult | null);
  const id = `terms-${plan}`;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="plan" value={plan} />
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-left text-xs text-slate-600">
        <input id={id} type="checkbox" name="acceptTerms" required className="mt-0.5 size-4 shrink-0 accent-teal" />
        <span>
          J&apos;accepte les{" "}
          <Link href="/conditions-abonnement" target="_blank" className="font-semibold text-navy underline">
            conditions d&apos;abonnement
          </Link>{" "}
          et confirme ma souscription au forfait sélectionné.
        </span>
      </label>
      <SubmitButton full variant={variant} pendingLabel="Ouverture du paiement sécurisé…">
        {label}
      </SubmitButton>
      {state && !state.ok && <FieldError message={state.error} />}
    </form>
  );
}

/** Portail client Stripe : moyen de paiement, factures, changement de formule, résiliation. */
export function PortalButton({ label = "Gérer mon abonnement", variant = "outline" }: { label?: string; variant?: "primary" | "secondary" | "outline" }) {
  const [state, action] = useActionState(async () => openBillingPortal(), null as ActionResult | null);
  return (
    <form action={action}>
      <SubmitButton variant={variant} pendingLabel="Ouverture du portail…">
        {label}
      </SubmitButton>
      {state && !state.ok && <FieldError message={state.error} />}
    </form>
  );
}
