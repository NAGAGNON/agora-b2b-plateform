"use client";

import { Search, Upload } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/form";
import { addSuppression, enrichProspectNow, importProspects, removeSuppression, saveProspect, setProspectStatus } from "@/app/actions/outreach";

type Prospect = {
  id?: string;
  name?: string;
  email?: string | null;
  email_source?: string | null;
  siren?: string | null;
  naf_code?: string | null;
  activity?: string | null;
  services?: string[];
  sectors?: string[];
  city?: string | null;
  department_code?: string | null;
  intervention_zone?: string;
  website?: string | null;
  contact_name?: string | null;
  source?: string;
};

export function ProspectForm({ prospect, sectors, departments }: { prospect?: Prospect; sectors: { slug: string; label: string }[]; departments: { code: string; name: string }[] }) {
  const p = prospect ?? {};
  return (
    <ActionForm action={saveProspect} hidden={p.id ? { id: p.id } : {}} className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Label htmlFor="name">Nom de l&apos;entreprise *</Label>
        <Input id="name" name="name" defaultValue={p.name ?? ""} required maxLength={200} />
      </div>
      <div>
        <Label htmlFor="email">E-mail professionnel</Label>
        <Input id="email" name="email" type="email" defaultValue={p.email ?? ""} placeholder="contact@entreprise.fr" />
      </div>
      <div>
        <Label htmlFor="email_source">Origine de l&apos;adresse e-mail</Label>
        <Input id="email_source" name="email_source" defaultValue={p.email_source ?? ""} placeholder="ex. site officiel de l'entreprise, page Contact (consulté le …)" />
      </div>
      <div>
        <Label htmlFor="siren">SIREN</Label>
        <Input id="siren" name="siren" defaultValue={p.siren ?? ""} inputMode="numeric" maxLength={9} />
      </div>
      <div>
        <Label htmlFor="naf_code">Code NAF</Label>
        <Input id="naf_code" name="naf_code" defaultValue={p.naf_code ?? ""} placeholder="43.21A" maxLength={6} />
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="activity">Activité / description</Label>
        <Textarea id="activity" name="activity" defaultValue={p.activity ?? ""} rows={3} maxLength={2000} />
      </div>
      <div className="md:col-span-2">
        <Label htmlFor="services">Services (séparés par des virgules)</Label>
        <Input id="services" name="services" defaultValue={(p.services ?? []).join(", ")} />
      </div>
      <fieldset className="md:col-span-2">
        <legend className="mb-1.5 text-sm font-semibold text-navy">Secteurs</legend>
        <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
          {sectors.map((s) => (
            <Checkbox key={s.slug} name="sectors" value={s.slug} label={s.label} defaultChecked={p.sectors?.includes(s.slug)} />
          ))}
        </div>
      </fieldset>
      <div>
        <Label htmlFor="city">Ville</Label>
        <Input id="city" name="city" defaultValue={p.city ?? ""} />
      </div>
      <div>
        <Label htmlFor="department_code">Département</Label>
        <Select id="department_code" name="department_code" defaultValue={p.department_code ?? ""}>
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d.code} value={d.code}>
              {d.code} — {d.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="intervention_zone">Zone d&apos;intervention</Label>
        <Select id="intervention_zone" name="intervention_zone" defaultValue={p.intervention_zone ?? "REGIONAL"}>
          <option value="LOCAL">Département</option>
          <option value="REGIONAL">Région</option>
          <option value="NATIONAL">Toute la France</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="website">Site internet</Label>
        <Input id="website" name="website" defaultValue={p.website ?? ""} />
      </div>
      <div>
        <Label htmlFor="contact_name">Contact</Label>
        <Input id="contact_name" name="contact_name" defaultValue={p.contact_name ?? ""} />
      </div>
      <div>
        <Label htmlFor="source">Origine des données *</Label>
        <Input id="source" name="source" defaultValue={p.source ?? ""} required placeholder="ex. Saisie manuelle — salon BTP Rennes 2026" />
      </div>
      <div className="md:col-span-2">
        <SubmitButton pendingLabel="Enregistrement…">{p.id ? "Enregistrer" : "Ajouter l'entreprise"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ImportForm() {
  return (
    <ActionForm action={importProspects} hidden={{}} className="space-y-4">
      <div>
        <Label htmlFor="file">Fichier CSV</Label>
        <input id="file" name="file" type="file" accept=".csv,text/csv" required className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-sky file:px-4 file:py-2 file:font-semibold file:text-navy" />
        <p className="mt-1 text-xs text-slate-500">
          Colonnes reconnues : nom, email, siren, siret, naf, activite, services, mots cles, secteur, ville, code postal, departement, region, zone, site, contact,
          source email. Séparateur « ; » ou « , ».
        </p>
      </div>
      <div>
        <Label htmlFor="import-source">Origine du fichier *</Label>
        <Input id="import-source" name="source" required placeholder="ex. Fichier B2B acheté à … le …, ou export CRM interne" />
      </div>
      <Checkbox name="attest" label="Je confirme que ces données ont été obtenues légalement et peuvent être utilisées pour de la prospection B2B (adresses professionnelles, liées à l'activité des entreprises)." />
      <SubmitButton pendingLabel="Import…">
        <Upload className="size-4" aria-hidden /> Importer
      </SubmitButton>
    </ActionForm>
  );
}

export function ProspectStatusButtons({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "ACTIVE" && status !== "DO_NOT_CONTACT" && (
        <ActionForm action={setProspectStatus} hidden={{ id, status: "ACTIVE" }}>
          <SubmitButton variant="outline" size="sm" pendingLabel="…">
            Réactiver
          </SubmitButton>
        </ActionForm>
      )}
      {status === "ACTIVE" && (
        <ActionForm action={setProspectStatus} hidden={{ id, status: "EXCLUDED" }}>
          <SubmitButton variant="outline" size="sm" pendingLabel="…">
            Exclure
          </SubmitButton>
        </ActionForm>
      )}
      {status !== "DO_NOT_CONTACT" && (
        <ActionForm action={setProspectStatus} hidden={{ id, status: "DO_NOT_CONTACT" }}>
          <SubmitButton variant="danger" size="sm" pendingLabel="…">
            Ne plus contacter
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

export function EnrichButton({ id }: { id: string }) {
  return (
    <ActionForm action={enrichProspectNow} hidden={{ id }}>
      <SubmitButton variant="secondary" size="sm" pendingLabel="Recherche…">
        <Search className="size-4" aria-hidden /> Rechercher l&apos;adresse e-mail
      </SubmitButton>
    </ActionForm>
  );
}

export function SuppressionForm() {
  return (
    <ActionForm action={addSuppression} hidden={{}} className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto] sm:items-end">
      <div>
        <Label htmlFor="value">E-mail, domaine ou SIREN</Label>
        <Input id="value" name="value" required placeholder="contact@entreprise.fr, entreprise.fr ou 123456789" />
      </div>
      <div>
        <Label htmlFor="note">Note</Label>
        <Input id="note" name="note" placeholder="Motif (facultatif)" />
      </div>
      <SubmitButton pendingLabel="Ajout…">Ajouter</SubmitButton>
    </ActionForm>
  );
}

export function RemoveSuppression({ id }: { id: string }) {
  return (
    <ActionForm action={removeSuppression} hidden={{ id }}>
      <SubmitButton variant="ghost" size="sm" pendingLabel="…">
        Retirer
      </SubmitButton>
    </ActionForm>
  );
}
