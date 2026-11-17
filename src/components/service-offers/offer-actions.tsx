"use client";

import { useActionState, useState, useTransition } from "react";
import { Archive, RotateCcw, Send } from "lucide-react";
import { contactServiceOffer, moderateServiceOffer, setServiceOfferStatus, suggestServiceOffer } from "@/app/actions/service-offers";
import type { ActionResult } from "@/lib/validation";
import { Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";

/** Écrire à l'entreprise disponible : la conversation s'ouvre ensuite dans la messagerie. */
export function ContactOfferForm({ offerId, companyName }: { offerId: string; companyName: string }) {
  const [draft, setDraft] = useState("");
  const [state, action] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    setDraft(String(fd.get("body") ?? ""));
    return contactServiceOffer(prev, fd);
  }, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-3" data-testid="contact-offer">
      <input type="hidden" name="offerId" value={offerId} />
      {state && !state.ok && !fe?.body && <Notice tone="error">{state.error}</Notice>}
      <label htmlFor="offer-message" className="text-sm font-semibold text-navy">
        Votre message à {companyName}
      </label>
      <Textarea
        id="offer-message"
        name="body"
        rows={5}
        maxLength={5000}
        defaultValue={draft}
        aria-invalid={Boolean(fe?.body)}
        placeholder="Bonjour, nous cherchons une entreprise pour… (lieu, période, quantités). Pouvez-vous nous faire une proposition ?"
      />
      {fe?.body && <p className="text-sm text-rose-700">{fe.body}</p>}
      <SubmitButton pendingLabel="Envoi…" className="w-full">
        <Send className="size-4" aria-hidden /> Envoyer mon message
      </SubmitButton>
      <p className="text-xs text-slate-500">L&apos;entreprise est prévenue par e-mail. La suite de l&apos;échange se fait dans votre messagerie.</p>
    </form>
  );
}

/** Retirer, remettre en ligne ou prolonger une disponibilité (espace de l'entreprise). */
export function OfferStatusButton({ id, to, label }: { id: string; to: "PUBLISHED" | "ARCHIVED"; label: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (to === "ARCHIVED" && !window.confirm("Retirer cette disponibilité du site ? Vous pourrez la remettre en ligne plus tard.")) return;
        start(async () => {
          const r = await setServiceOfferStatus(id, to);
          toast(r.ok ? (r.message ?? "C'est fait.") : r.error, r.ok ? undefined : "error");
        });
      }}
      className={
        to === "PUBLISHED"
          ? "inline-flex items-center gap-1.5 rounded-xl bg-navy px-3.5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
          : "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
      }
    >
      {to === "PUBLISHED" ? <RotateCcw className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />} {label}
    </button>
  );
}

/** Équipe : retirer une disponibilité avec un motif (transmis à l'entreprise) ou la remettre en ligne. */
export function ModerateOfferButton({ id, removed }: { id: string; removed: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const reason = removed ? "" : window.prompt("Motif du retrait (transmis à l'entreprise) :", "Cette annonce ne correspond pas à une disponibilité professionnelle.");
        if (!removed && !reason) return;
        start(async () => {
          const r = await moderateServiceOffer(id, removed ? "RESTORE" : "REMOVE", reason ?? "");
          toast(r.ok ? (r.message ?? "C'est fait.") : r.error, r.ok ? undefined : "error");
        });
      }}
      className={removed ? "rounded-lg px-3 py-1.5 text-sm font-semibold text-teal-700 ring-1 ring-teal/40 hover:bg-teal-50" : "rounded-lg px-3 py-1.5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"}
    >
      {removed ? "Remettre en ligne" : "Retirer"}
    </button>
  );
}

/** Équipe : proposer à l'entreprise de republier son besoin (offre de services) en disponibilité. */
export function SuggestOfferButton({ opportunityId }: { opportunityId: string }) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const toast = useToast();
  if (sent) return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Proposition envoyée</span>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Envoyer à cette entreprise une notification (et un e-mail) lui proposant de republier son texte en disponibilité ?")) return;
        start(async () => {
          const r = await suggestServiceOffer(opportunityId);
          toast(r.ok ? (r.message ?? "C'est fait.") : r.error, r.ok ? undefined : "error");
          if (r.ok) setSent(true);
        });
      }}
      className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
    >
      Proposer la disponibilité
    </button>
  );
}
