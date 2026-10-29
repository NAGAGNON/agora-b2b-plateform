"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount, inviteMember, removeMember, setMemberRole, updateUserProfile } from "@/app/actions/company";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { COMPANY_ROLE_LABELS, type CompanyRole } from "@/lib/constants";
import { ActionError } from "@/components/billing/upgrade-prompt";
import { LegalNote } from "@/components/legal-note";

type NotifyPrefs = Partial<Record<"need_reminders" | "pipeline" | "matching" | "status", boolean>>;

export function UserProfileForm({ v }: { v: { full_name: string; job_title: string | null; phone: string | null; notify_email: boolean; notify_prefs?: unknown; marketing_consent: boolean; email: string } }) {
  const [state, action] = useActionState(updateUserProfile, null);
  const prefs = (v.notify_prefs && typeof v.notify_prefs === "object" ? v.notify_prefs : {}) as NotifyPrefs;
  const on = (k: keyof NotifyPrefs) => prefs[k] !== false;
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-5">
      <Field label="Adresse e-mail" name="email" hint="L'adresse de connexion ne peut pas être modifiée ici : contactez-nous pour la changer.">
        {(p) => <Input {...p} value={v.email} disabled readOnly />}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nom et prénom" name="fullName" error={fe?.fullName} required>
          {(p) => <Input {...p} defaultValue={v.full_name} maxLength={120} autoComplete="name" />}
        </Field>
        <Field label="Fonction" name="jobTitle" error={fe?.jobTitle}>
          {(p) => <Input {...p} defaultValue={v.job_title ?? ""} maxLength={120} autoComplete="organization-title" />}
        </Field>
      </div>
      <Field label="Téléphone" name="phone" error={fe?.phone} hint="Non affiché publiquement.">
        {(p) => <Input {...p} type="tel" defaultValue={v.phone ?? ""} maxLength={30} autoComplete="tel" />}
      </Field>
      <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-navy">Notifications par e-mail</legend>
        <Checkbox name="notifyEmail" defaultChecked={v.notify_email} label="Recevoir les notifications par e-mail" hint="Interrupteur général. Les messages, marques d'intérêt et réponses reçus sont toujours envoyés." />
        <div className="space-y-3 border-l-2 border-slate-100 pl-4">
          <Checkbox name="notifyNeedReminders" defaultChecked={on("need_reminders")} label="Rappels sur mes besoins" hint="Besoin sans réponse après 3 jours, date limite dans moins de 48 h." />
          <Checkbox name="notifyStatus" defaultChecked={on("status")} label="Décisions et changements de statut" hint="Publication, modification demandée, clôture, réponse retenue ou déclinée." />
          <Checkbox name="notifyMatching" defaultChecked={on("matching")} label="Opportunités et besoins qui correspondent à mon activité" hint="Alertes immédiates et besoins publiés dans votre métier." />
          <Checkbox name="notifyPipeline" defaultChecked={on("pipeline")} label="Relances du pipeline commercial" hint="Le jour de chaque « prochaine action » prévue." />
        </div>
      </fieldset>
      <Checkbox name="marketingConsent" defaultChecked={v.marketing_consent} label="Recevoir la veille et les actualités de LinkProB2B" hint="Sélections d'opportunités le lundi et le vendredi. Réglages détaillés : Veille par e-mail." />
      {state?.ok && <Notice tone="success">{state.message}</Notice>}
      <ActionError state={state} />
      <SubmitButton>Enregistrer</SubmitButton>
      <LegalNote>Gestion de vos données personnelles : voir les</LegalNote>
    </form>
  );
}

export function InviteMemberForm() {
  const [state, action] = useActionState(inviteMember, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
      <Field label="E-mail du collègue" name="email" error={fe?.email} required>
        {(p) => <Input {...p} type="email" />}
      </Field>
      <Field label="Rôle" name="role">
        {(p) => (
          <Select {...p} defaultValue="COMPANY_MEMBER">
            <option value="COMPANY_MEMBER">Membre</option>
            <option value="COMPANY_ADMIN">Administrateur</option>
          </Select>
        )}
      </Field>
      <SubmitButton>Ajouter</SubmitButton>
      {state && <Notice tone={state.ok ? "success" : "error"} className="sm:col-span-3">{state.ok ? state.message : state.error}</Notice>}
    </form>
  );
}

export function MemberControls({ memberId, role, isSelf, canManage }: { memberId: string; role: CompanyRole; isSelf: boolean; canManage: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  if (!canManage && !isSelf) return <span className="text-sm text-slate-600">{COMPANY_ROLE_LABELS[role]}</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canManage ? (
        <select
          value={role}
          disabled={pending}
          aria-label="Rôle"
          onChange={(e) =>
            start(async () => {
              const r = await setMemberRole(memberId, e.target.value as CompanyRole);
              toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
              router.refresh();
            })
          }
          className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
        >
          <option value="COMPANY_MEMBER">Membre</option>
          <option value="COMPANY_ADMIN">Administrateur</option>
        </select>
      ) : (
        <span className="text-sm text-slate-600">{COMPANY_ROLE_LABELS[role]}</span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(isSelf ? "Quitter cette entreprise ?" : "Retirer ce membre de l'entreprise ?")) return;
          start(async () => {
            const r = await removeMember(memberId);
            toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
            router.refresh();
          });
        }}
        className="text-sm font-semibold text-red-700 hover:underline"
      >
        {isSelf ? "Quitter" : "Retirer"}
      </button>
    </div>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Tapez SUPPRIMER pour confirmer" name="confirm" error={state && !state.ok ? state.fieldErrors?.confirm : undefined}>
        {(p) => <Input {...p} autoComplete="off" />}
      </Field>
      {state && !state.ok && !state.fieldErrors && <Notice tone="error">{state.error}</Notice>}
      <SubmitButton variant="danger">Supprimer définitivement mon compte</SubmitButton>
    </form>
  );
}
