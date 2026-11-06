"use client";

import Link from "next/link";
import { useActionState } from "react";
import { openBillingPortal, startCheckout, startFounderCheckout, startProTrial } from "@/app/actions/billing";
import { SubmitButton } from "@/components/ui/submit-button";
import { FieldError } from "@/components/ui/form";
import type { ActionResult } from "@/lib/validation";

/** Souscription : case d'acceptation non pré-cochée, obligatoire, contrôlée aussi côté serveur. */
export function CheckoutForm({
  plan,
  label,
  interval = "month",
  variant = "primary",
}: {
  plan: "PRO" | "BUSINESS";
  label: string;
  interval?: "month" | "year";
  variant?: "primary" | "secondary" | "outline";
}) {
  const [state, action] = useActionState(startCheckout, null as ActionResult | null);
  const id = `terms-${plan}-${interval}`;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="interval" value={interval} />
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

/** Souscription « membre fondateur » (offre Pro à moitié prix, à vie) : même acceptation explicite. */
export function FounderCheckoutForm({ label, disabled = false }: { label: string; disabled?: boolean }) {
  const [state, action] = useActionState(startFounderCheckout, null as ActionResult | null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="interval" value="month" />
      <label htmlFor="terms-founder" className="flex cursor-pointer items-start gap-2.5 text-left text-xs text-slate-600">
        <input id="terms-founder" type="checkbox" name="acceptTerms" required className="mt-0.5 size-4 shrink-0 accent-teal" />
        <span>
          J&apos;accepte les{" "}
          <Link href="/conditions-abonnement" target="_blank" className="font-semibold text-navy underline">
            conditions d&apos;abonnement
          </Link>{" "}
          et confirme ma souscription à l&apos;offre Pro au tarif fondateur.
        </span>
      </label>
      <SubmitButton full size="lg" disabled={disabled} className="btn-shine" pendingLabel="Ouverture du paiement sécurisé…">
        {label}
      </SubmitButton>
      {state && !state.ok && <FieldError message={state.error} />}
    </form>
  );
}

/** Essai Pro de 14 jours, sans carte bancaire (une fois par entreprise). */
export function StartTrialForm({ suite, label = "Essayer Pro gratuitement 14 jours", hint = true }: { suite: string; label?: string; hint?: boolean }) {
  const [state, action] = useActionState(startProTrial, null as ActionResult | null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="suite" value={suite} />
      <SubmitButton full size="lg" pendingLabel="Activation…">
        {label}
      </SubmitButton>
      {hint && <p className="text-center text-xs text-slate-500">Sans carte bancaire · aucun prélèvement à la fin de l&apos;essai</p>}
      {state && !state.ok && <FieldError message={state.error} />}
    </form>
  );
}
