"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAccount, inviteMember, removeMember, setMemberRole, updateUserProfile } from "@/app/actions/company";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { COMPANY_ROLE_LABELS, type CompanyRole } from "@/lib/constants";

export function UserProfileForm({ v }: { v: { full_name: string; job_title: string | null; phone: string | null; notify_email: boolean; marketing_consent: boolean; email: string } }) {
  const [state, action] = useActionState(updateUserProfile, null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={action} className="space-y-5">
      <Field label="Adresse e-mail" name="email" hint="L'adresse de connexion ne peut pas être modifiée ici pendant le pilote.">
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
      <Checkbox name="notifyEmail" defaultChecked={v.notify_email} label="Recevoir les notifications par e-mail" hint="Nouvelles réponses, messages, décisions, alertes." />
      <Checkbox name="marketingConsent" defaultChecked={v.marketing_consent} label="Recevoir les informations sur le pilote LinkProB2B" />
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.ok ? state.message : state.error}</Notice>}
      <SubmitButton>Enregistrer</SubmitButton>
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
