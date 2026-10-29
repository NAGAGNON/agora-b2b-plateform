"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { saveNeedDraft } from "@/lib/need-draft";
import { trackCta } from "@/app/actions/cta";
import type { SectorOption } from "@/lib/constants";

/**
 * Page Publier, visiteur sans compte : il décrit d'abord son besoin (30 secondes), puis crée son
 * compte ; le besoin est repris automatiquement dans l'assistant de publication.
 */
export function NeedDraftForm({ sectors }: { sectors: SectorOption[] }) {
  const router = useRouter();
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    saveNeedDraft({ title: String(fd.get("title") ?? ""), description: String(fd.get("description") ?? ""), sector: String(fd.get("sector") ?? ""), city: String(fd.get("city") ?? "") });
    void trackCta("publier_brouillon", "/publier").catch(() => undefined);
    router.push("/inscription?suite=/publier");
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4" data-testid="need-draft">
      <Field label="Que recherchez-vous ?" name="title" required hint="Ex. « Entretien annuel de 3 chaudières » ou « Création d'un site internet vitrine ».">
        {(p) => <Input {...p} minLength={5} maxLength={180} required />}
      </Field>
      <Field label="Décrivez votre besoin" name="description" required hint="Quantités, délais, contraintes : plus c'est précis, plus les réponses sont pertinentes.">
        {(p) => <Textarea {...p} rows={4} minLength={20} maxLength={5000} required />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Secteur" name="sector">
          {(p) => (
            <Select {...p} defaultValue="">
              <option value="">Choisir (facultatif)</option>
              {sectors.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Ville" name="city">
          {(p) => <Input {...p} maxLength={120} autoComplete="address-level2" />}
        </Field>
      </div>
      <Button type="submit" size="lg" full>
        Continuer <ArrowRight className="size-4" aria-hidden />
      </Button>
      <p className="text-center text-sm text-slate-500">
        Gratuit, sans carte bancaire. Il ne reste qu&apos;à créer votre compte : votre besoin sera déjà rempli.
      </p>
    </form>
  );
}
