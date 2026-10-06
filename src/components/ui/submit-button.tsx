"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Button> & { pendingLabel?: string };

/** Bouton d'envoi qui affiche l'état de chargement du formulaire parent. */
export function SubmitButton({ children, pendingLabel, disabled, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? (pendingLabel ?? "Envoi…") : children}
    </Button>
  );
}
