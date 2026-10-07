"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { saveSector } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

export type SectorRow = { slug: string; label: string; description: string | null; sort_order: number; is_active: boolean; is_pilot_priority: boolean };

/** Ajout (sans `sector`) ou modification d'un secteur du référentiel. */
export function SectorEditor({ sector }: { sector?: SectorRow }) {
  const [open, setOpen] = useState(false);
  const create = !sector;
  return (
    <>
      {create ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden /> Ajouter un secteur
        </Button>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Modifier le secteur ${sector.label}`}>
          <Pencil className="size-4" aria-hidden /> Modifier
        </Button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={create ? "Nouveau secteur" : `Secteur : ${sector.label}`}>
        <ActionForm action={saveSector} hidden={{ mode: create ? "create" : "update", ...(create ? {} : { slug: sector.slug }) }} onDone={() => setOpen(false)} className="space-y-4">
          {create && (
            <Field label="Identifiant (URL)" name="slug" required hint="Ex. : agroalimentaire. Minuscules et tirets ; non modifiable ensuite.">
              {(p) => <Input {...p} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={60} />}
            </Field>
          )}
          <Field label="Libellé" name="label" required>
            {(p) => <Input {...p} required maxLength={80} defaultValue={sector?.label} />}
          </Field>
          <Field label="Description" name="description">
            {(p) => <Textarea {...p} rows={3} maxLength={300} defaultValue={sector?.description ?? ""} />}
          </Field>
          <Field label="Ordre d'affichage" name="sortOrder">
            {(p) => <Input {...p} type="number" min={0} max={999} defaultValue={sector?.sort_order ?? 100} />}
          </Field>
          <Checkbox name="isActive" defaultChecked={sector?.is_active ?? true} label="Actif" hint="Un secteur inactif n'est plus proposé dans les formulaires et filtres ; les données existantes sont conservées." />
          <Checkbox name="isPilotPriority" defaultChecked={sector?.is_pilot_priority ?? false} label="Secteur prioritaire (mis en avant)" />
          <SubmitButton>{create ? "Ajouter" : "Enregistrer"}</SubmitButton>
        </ActionForm>
      </Modal>
    </>
  );
}
