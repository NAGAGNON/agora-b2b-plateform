"use client";

import { useActionState, useState } from "react";
import type { ActionResult } from "@/lib/validation";
import { Bookmark, BellPlus } from "lucide-react";
import Link from "next/link";
import { saveSearch } from "@/app/actions/engagement";
import { Modal } from "@/components/ui/modal";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";

/** Actions « Sauvegarder la recherche » et « Créer une alerte » depuis les résultats. */
export function SearchActions({ query, signedIn, alertHref, scope = "OPPORTUNITIES" }: { query: string; signedIn: boolean; alertHref: string; scope?: "OPPORTUNITIES" | "COMPANIES" }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const [state, action] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const r = await saveSearch(prev, fd);
    if (r.ok) {
      setOpen(false);
      toast(r.message ?? "Recherche sauvegardée.");
    }
    return r;
  }, null);
  if (!signedIn) {
    const next = encodeURIComponent(`/opportunites${query ? `?${query}` : ""}`);
    return (
      <Link href={`/connexion?suite=${next}`} className={buttonClasses({ variant: "outline", size: "sm" })}>
        <Bookmark className="size-4" aria-hidden /> Sauvegarder / créer une alerte
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Bookmark className="size-4" aria-hidden /> Sauvegarder la recherche
      </Button>
      {scope === "OPPORTUNITIES" && (
        <Link href={alertHref} className={buttonClasses({ variant: "outline", size: "sm" })}>
          <BellPlus className="size-4" aria-hidden /> Créer une alerte
        </Link>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Sauvegarder cette recherche">
        <form action={action} className="space-y-4">
          <input type="hidden" name="query" value={query} />
          <input type="hidden" name="scope" value={scope} />
          <Field label="Nom de la recherche" name="name" required error={state && !state.ok ? state.fieldErrors?.name : undefined}>
            {(p) => <Input {...p} placeholder="ex. Informatique Île-de-France" maxLength={120} />}
          </Field>
          {state && !state.ok && !state.fieldErrors?.name && <Notice tone="error">{state.error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <SubmitButton>Sauvegarder</SubmitButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
