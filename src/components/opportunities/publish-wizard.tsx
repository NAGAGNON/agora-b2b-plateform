"use client";

import { useActionState, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, FileText, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { createOpportunity, updateOpportunity } from "@/app/actions/opportunities";
import { uploadFiles } from "@/lib/direct-upload";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { FileUploader } from "@/components/ui/file-uploader";
import { Notice } from "@/components/ui/notice";
import { Badge } from "@/components/ui/badge";
import { OriginBadge } from "@/components/opportunities/opportunity-badge";
import {
  COMPANY_SIZE_LABELS,
  INTERNAL_TYPES,
  OPPORTUNITY_TYPE_HELP,
  OPPORTUNITY_TYPE_LABELS,
  sectorLabel,
  type SectorOption,
  type CompanySize,
  type OpportunityType,
} from "@/lib/constants";
import { formatBudget, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/lib/validation";

export type WizardValues = {
  id?: string;
  type?: OpportunityType;
  title?: string;
  summary?: string | null;
  description?: string;
  sector_slug?: string | null;
  city?: string | null;
  postal_code?: string | null;
  department_code?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_visible?: boolean;
  start_date?: string | null;
  response_deadline?: string | null;
  skills?: string[];
  services?: string | null;
  constraints?: string | null;
  criteria?: string | null;
  max_suppliers?: number | null;
  visibility?: "PUBLIC" | "MEMBERS_ONLY";
  target_company_size?: CompanySize | null;
  keywords?: string[];
  contact_name?: string | null;
};

const STEPS = ["Type", "Informations", "Besoin technique", "Conditions", "Aperçu", "Publication"] as const;

/** Champs → étape (pour revenir sur l'étape en erreur après validation serveur). */
const FIELD_STEP: Record<string, number> = {
  type: 0,
  title: 1,
  summary: 1,
  description: 1,
  sector: 1,
  city: 1,
  postalCode: 1,
  departmentCode: 1,
  budgetMin: 1,
  budgetMax: 1,
  startDate: 1,
  skills: 2,
  services: 2,
  constraints: 2,
  keywords: 2,
  files: 2,
  maxSuppliers: 3,
  criteria: 3,
  visibility: 3,
  responseDeadline: 3,
  targetCompanySize: 3,
  contactName: 3,
  attest: 5,
};

type Place = { name: string; postal_code: string; department_code: string };
type Dept = { code: string; name: string };

export function PublishWizard({
  values = {},
  places,
  departments,
  sectors,
  companyName,
  existingDocuments = [],
}: {
  values?: WizardValues;
  places: Place[];
  departments: Dept[];
  sectors: SectorOption[];
  companyName: string;
  existingDocuments?: { id: string; file_name: string }[];
}) {
  const edit = Boolean(values.id);
  const [step, setStep] = useState(values.type ? 1 : 0);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  const [state, dispatch] = useActionState<ActionResult<{ id: string; intent: string }> | null, FormData>(async (prev, fd) => {
    const r = await (edit ? updateOpportunity : createOpportunity)(prev, fd);
    if (!r.ok) {
      if (r.fieldErrors) {
        // Revient à la première étape contenant une erreur.
        const first = Object.keys(r.fieldErrors).map((k) => FIELD_STEP[k] ?? 5).sort((a, b) => a - b)[0];
        if (first !== undefined) setStep(first);
      }
      return r;
    }
    const id = r.data!.id;
    let suffix = edit ? "modifie=1" : `cree=${r.data!.intent}`;
    if (files.length) {
      setUploading(true);
      const { errors } = await uploadFiles("opportunity", id, files);
      if (errors.length) suffix = `erreur=${encodeURIComponent(errors.join(" "))}`;
    }
    router.push(`/dashboard/opportunites/${id}?${suffix}`);
    return r;
  }, null);
  const [pending, start] = useTransition();
  const [type, setType] = useState<OpportunityType>(values.type ?? "NEED");
  const [snapshot, setSnapshot] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const stepRefs = useRef<(HTMLFieldSetElement | null)[]>([]);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  function takeSnapshot() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    const snap: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (typeof v === "string") snap[k] = v;
    setSnapshot(snap);
  }

  function go(next: number) {
    if (next > step) {
      // Validation native de l'étape courante avant d'avancer.
      const fs = stepRefs.current[step];
      const controls = fs ? Array.from(fs.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")) : [];
      for (const c of controls) {
        if (!c.checkValidity()) {
          c.reportValidity();
          return;
        }
      }
    }
    if (next === 4) takeSnapshot();
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(e.currentTarget);
    fd.set("intent", submitter?.value === "submit" ? "submit" : "draft");
    start(() => dispatch(fd));
  }

  const consult = type === "PRIVATE_CONSULTATION" || type === "PRIVATE_TENDER";
  const deadlineDefault = values.response_deadline ? values.response_deadline.slice(0, 10) : "";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <ol className="mb-8 grid grid-cols-6 gap-1" aria-label="Étapes de publication">
        {STEPS.map((label, i) => (
          <li key={label} className="text-center">
            <button
              type="button"
              onClick={() => i < step && go(i)}
              disabled={i > step}
              aria-current={i === step ? "step" : undefined}
              className="group flex w-full flex-col items-center gap-1.5 disabled:cursor-default"
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm font-bold",
                  i < step ? "bg-teal text-white" : i === step ? "bg-navy text-white" : "bg-slate-200 text-slate-500",
                )}
              >
                {i < step ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn("hidden text-xs font-semibold sm:block", i === step ? "text-navy" : "text-slate-500")}>{label}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mb-4 text-sm font-semibold text-slate-500 sm:hidden">
        Étape {step + 1} / 6 — {STEPS[step]}
      </p>

      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-6">
        {values.id && <input type="hidden" name="id" value={values.id} />}

        {/* Étape 1 — Type */}
        <fieldset ref={(el) => { stepRefs.current[0] = el; }} hidden={step !== 0} className="space-y-3">
          <legend className="mb-3 text-xl font-bold text-navy">Quel type de demande souhaitez-vous publier ?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {INTERNAL_TYPES.map((t) => (
              <label
                key={t}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-4 transition",
                  type === t ? "border-teal bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300",
                )}
              >
                <span className="flex items-center gap-2">
                  <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="size-4 accent-teal" />
                  <span className="font-bold text-navy">{OPPORTUNITY_TYPE_LABELS[t]}</span>
                </span>
                <span className="pl-6 text-sm text-slate-600">{OPPORTUNITY_TYPE_HELP[t]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Étape 2 — Informations */}
        <fieldset ref={(el) => { stepRefs.current[1] = el; }} hidden={step !== 1} className="space-y-5">
          <legend className="mb-3 text-xl font-bold text-navy">Informations principales</legend>
          <Field label="Titre" name="title" error={fe?.title} required hint="Soyez précis : « Maintenance préventive de 3 compresseurs d'air » plutôt que « Maintenance ».">
            {(p) => <Input {...p} defaultValue={values.title} minLength={5} maxLength={180} required />}
          </Field>
          <Field label="Résumé" name="summary" error={fe?.summary} hint="Une ou deux phrases affichées dans les résultats (400 caractères).">
            {(p) => <Textarea {...p} defaultValue={values.summary ?? ""} rows={2} maxLength={400} />}
          </Field>
          <Field label="Description détaillée" name="description" error={fe?.description} required>
            {(p) => <Textarea {...p} defaultValue={values.description} rows={8} minLength={20} maxLength={20000} required />}
          </Field>
          <Field label="Secteur" name="sector" error={fe?.sector} required>
            {(p) => (
              <Select {...p} defaultValue={values.sector_slug ?? ""} required>
                <option value="" disabled>
                  Choisir un secteur
                </option>
                {sectors.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Ville" name="city" error={fe?.city} className="sm:col-span-2">
              {(p) => (
                <>
                  <Input {...p} defaultValue={values.city ?? ""} list="wizard-places" />
                  <datalist id="wizard-places">
                    {places.map((pl) => (
                      <option key={pl.name} value={pl.name}>
                        {pl.postal_code}
                      </option>
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Code postal" name="postalCode" error={fe?.postalCode}>
              {(p) => <Input {...p} defaultValue={values.postal_code ?? ""} inputMode="numeric" maxLength={5} />}
            </Field>
          </div>
          <Field label="Département" name="departmentCode" error={fe?.departmentCode}>
            {(p) => (
              <Select {...p} defaultValue={values.department_code ?? ""}>
                <option value="">Déduit de la ville</option>
                {departments.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Budget minimum (€ HT)" name="budgetMin" error={fe?.budgetMin}>
              {(p) => <Input {...p} type="number" min={0} step="100" defaultValue={values.budget_min ?? ""} />}
            </Field>
            <Field label="Budget maximum (€ HT)" name="budgetMax" error={fe?.budgetMax}>
              {(p) => <Input {...p} type="number" min={0} step="100" defaultValue={values.budget_max ?? ""} />}
            </Field>
          </div>
          <Checkbox name="budgetVisible" defaultChecked={values.budget_visible ?? true} label="Afficher le budget publiquement" hint="Sinon, il reste interne à votre entreprise." />
          <Field label="Démarrage souhaité" name="startDate" error={fe?.startDate}>
            {(p) => <Input {...p} type="date" defaultValue={values.start_date ?? ""} />}
          </Field>
        </fieldset>

        {/* Étape 3 — Besoin technique */}
        <fieldset ref={(el) => { stepRefs.current[2] = el; }} hidden={step !== 2} className="space-y-5">
          <legend className="mb-3 text-xl font-bold text-navy">Besoin technique</legend>
          <Field label="Compétences recherchées" name="skills" error={fe?.skills} hint="Séparées par des virgules (20 maximum).">
            {(p) => <Input {...p} defaultValue={values.skills?.join(", ") ?? ""} placeholder="ex. hydraulique, automatisme, soudure" />}
          </Field>
          <Field label="Prestations attendues" name="services" error={fe?.services}>
            {(p) => <Textarea {...p} defaultValue={values.services ?? ""} rows={4} maxLength={4000} />}
          </Field>
          <Field label="Contraintes" name="constraints" error={fe?.constraints} hint="Horaires, sécurité, habilitations, accès au site…">
            {(p) => <Textarea {...p} defaultValue={values.constraints ?? ""} rows={3} maxLength={4000} />}
          </Field>
          <Field label="Mots-clés" name="keywords" error={fe?.keywords} hint="Aident les fournisseurs à trouver votre besoin.">
            {(p) => <Input {...p} defaultValue={values.keywords?.join(", ") ?? ""} />}
          </Field>
          <div>
            <p className="mb-2 text-sm font-semibold text-navy">Documents (cahier des charges, plans…)</p>
            {existingDocuments.length > 0 && (
              <ul className="mb-3 space-y-1 text-sm">
                {existingDocuments.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-slate-600">
                    <FileText className="size-4" aria-hidden /> {d.file_name}
                  </li>
                ))}
              </ul>
            )}
            <FileUploader maxFiles={5} onChange={setFiles} />
            <p className="mt-2 text-xs text-slate-500">Les documents ne sont accessibles qu&apos;aux membres connectés. N&apos;y faites pas figurer de données personnelles inutiles.</p>
            {fe?.files && <p className="mt-1 text-sm text-red-600">{fe.files}</p>}
          </div>
        </fieldset>

        {/* Étape 4 — Conditions */}
        <fieldset ref={(el) => { stepRefs.current[3] = el; }} hidden={step !== 3} className="space-y-5">
          <legend className="mb-3 text-xl font-bold text-navy">Conditions de la consultation</legend>
          <Field
            label="Date limite de réponse"
            name="responseDeadline"
            error={fe?.responseDeadline}
            required={consult}
            hint={consult ? "Obligatoire pour une consultation ou un appel d'offres." : "Facultatif. Passée cette date, l'opportunité expire automatiquement."}
          >
            {(p) => <Input {...p} type="date" min={today} defaultValue={deadlineDefault} required={consult} />}
          </Field>
          <Field label="Nombre de fournisseurs souhaités" name="maxSuppliers" error={fe?.maxSuppliers}>
            {(p) => <Input {...p} type="number" min={1} max={100} defaultValue={values.max_suppliers ?? ""} />}
          </Field>
          <Field label="Critères de sélection" name="criteria" error={fe?.criteria} hint="ex. Prix 40 %, délai 30 %, références 30 %.">
            {(p) => <Textarea {...p} defaultValue={values.criteria ?? ""} rows={4} maxLength={4000} />}
          </Field>
          <Field label="Taille de fournisseur visée" name="targetCompanySize" error={fe?.targetCompanySize}>
            {(p) => (
              <Select {...p} defaultValue={values.target_company_size ?? ""}>
                <option value="">Indifférent</option>
                {(Object.keys(COMPANY_SIZE_LABELS) as CompanySize[]).map((k) => (
                  <option key={k} value={k}>
                    {COMPANY_SIZE_LABELS[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-navy">Confidentialité</legend>
            <div className="space-y-2">
              <label className="flex items-start gap-3 text-sm">
                <input type="radio" name="visibility" value="PUBLIC" defaultChecked={(values.visibility ?? "PUBLIC") === "PUBLIC"} className="mt-0.5 size-4 accent-teal" />
                <span>
                  <span className="font-semibold text-navy">Publique</span>
                  <span className="block text-slate-500">Visible par tous, y compris les moteurs de recherche.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input type="radio" name="visibility" value="MEMBERS_ONLY" defaultChecked={values.visibility === "MEMBERS_ONLY"} className="mt-0.5 size-4 accent-teal" />
                <span>
                  <span className="font-semibold text-navy">Réservée aux membres connectés</span>
                  <span className="block text-slate-500">Non indexée, visible uniquement par les utilisateurs inscrits.</span>
                </span>
              </label>
            </div>
          </fieldset>
          <Field label="Interlocuteur (facultatif)" name="contactName" error={fe?.contactName} hint="Nom affiché sur la fiche. Les échanges passent par la messagerie de la plateforme.">
            {(p) => <Input {...p} defaultValue={values.contact_name ?? ""} maxLength={120} />}
          </Field>
        </fieldset>

        {/* Étape 5 — Aperçu */}
        <section hidden={step !== 4} aria-labelledby="apercu" className="space-y-4">
          <h2 id="apercu" className="text-xl font-bold">
            Aperçu de votre publication
          </h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <OriginBadge origin="INTERNAL" />
              <Badge tone="sky">{OPPORTUNITY_TYPE_LABELS[type]}</Badge>
              {snapshot.visibility === "MEMBERS_ONLY" && <Badge tone="slate">Réservée aux membres</Badge>}
            </div>
            <h3 className="mt-3 text-xl font-bold">{snapshot.title || "(sans titre)"}</h3>
            <p className="text-sm text-slate-600">{companyName}</p>
            {snapshot.summary && <p className="mt-3 text-navy">{snapshot.summary}</p>}
            <p className="mt-3 text-sm whitespace-pre-line text-slate-700">{snapshot.description}</p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <Preview label="Secteur" value={sectorLabel(snapshot.sector, Object.fromEntries(sectors.map((s) => [s.slug, s.label])))} />
              <Preview label="Localisation" value={[snapshot.city, snapshot.postalCode].filter(Boolean).join(" ") || snapshot.departmentCode || "—"} />
              <Preview
                label="Budget"
                value={
                  snapshot.budgetVisible
                    ? (formatBudget(snapshot.budgetMin ? Number(snapshot.budgetMin) : null, snapshot.budgetMax ? Number(snapshot.budgetMax) : null) ?? "Non précisé")
                    : "Non communiqué"
                }
              />
              <Preview label="Date limite" value={snapshot.responseDeadline ? formatDate(snapshot.responseDeadline) : "Non précisée"} />
              <Preview label="Compétences" value={snapshot.skills || "—"} />
              <Preview label="Fournisseurs souhaités" value={snapshot.maxSuppliers || "—"} />
            </dl>
          </div>
          <Notice tone="info">Vérifiez les informations : vous pourrez encore les modifier tant que la publication n&apos;est pas validée.</Notice>
        </section>

        {/* Étape 6 — Publication */}
        <section hidden={step !== 5} aria-labelledby="publication" className="space-y-5">
          <h2 id="publication" className="text-xl font-bold">
            Publication
          </h2>
          <ol className="space-y-2 rounded-xl bg-sky p-4 text-sm text-navy">
            <li>1. Votre demande est envoyée à l&apos;équipe de modération (statut « En attente de validation »).</li>
            <li>2. Après validation, elle est publiée et les fournisseurs concernés sont alertés.</li>
            <li>3. Vous recevez les manifestations d&apos;intérêt et les réponses dans votre espace.</li>
          </ol>
          <Checkbox
            name="attest"
            label="Je certifie être autorisé(e) à publier ces informations au nom de mon entreprise, et qu'elles correspondent à un besoin réel."
            aria-invalid={Boolean(fe?.attest)}
          />
          {fe?.attest && <p className="text-sm text-red-600">{fe.attest}</p>}
        </section>

        {state && !state.ok && (
          <Notice tone="error" title="La publication n'a pas pu être enregistrée">
            {state.error}
            {fe && Object.keys(fe).length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {Object.entries(fe).map(([k, v]) => (
                  <li key={k}>{v}</li>
                ))}
              </ul>
            )}
          </Notice>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {step > 0 && (
              <Button variant="ghost" onClick={() => go(step - 1)} className="w-full sm:w-auto">
                <ArrowLeft className="size-4" aria-hidden /> Précédent
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            {step >= 1 && (
              <Button type="submit" name="intent" value="draft" variant="outline" disabled={pending} className="w-full sm:w-auto">
                <Save className="size-4" aria-hidden /> Enregistrer en brouillon
              </Button>
            )}
            {step < 5 ? (
              <Button onClick={() => go(step + 1)} className="w-full sm:w-auto">
                Suivant <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button type="submit" name="intent" value="submit" disabled={pending} className="w-full sm:w-auto">
                <Send className="size-4" aria-hidden /> {uploading ? "Envoi des documents…" : pending ? "Envoi…" : "Soumettre à validation"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function Preview({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500 uppercase">{label}</dt>
      <dd className="text-navy">{value}</dd>
    </div>
  );
}
