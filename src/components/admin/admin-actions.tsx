"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Edit, Pause, Play, ShieldCheck, X, Archive, RotateCcw, Wrench } from "lucide-react";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { markContactHandled, markDuplicate, moderateOpportunity, resolveReport, runMaintenance, setCompanyStatus, setUserRole, setUserStatus, updateSetting, verifyCompany, verifyExternal } from "@/app/actions/admin";
import { PLATFORM_ROLE_LABELS, type PlatformRole } from "@/lib/constants";

type ModAction = "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "SUSPEND" | "ARCHIVE" | "REINSTATE";
const MOD: Record<ModAction, { label: string; icon: typeof Check; variant: "primary" | "outline" | "danger" | "secondary"; reason: boolean }> = {
  APPROVE: { label: "Approuver et publier", icon: Check, variant: "primary", reason: false },
  REQUEST_CHANGES: { label: "Demander une modification", icon: Edit, variant: "outline", reason: true },
  REJECT: { label: "Refuser", icon: X, variant: "danger", reason: true },
  SUSPEND: { label: "Suspendre", icon: Pause, variant: "danger", reason: true },
  ARCHIVE: { label: "Archiver", icon: Archive, variant: "outline", reason: false },
  REINSTATE: { label: "Rétablir", icon: RotateCcw, variant: "primary", reason: false },
};

/** Actions de modération d'une opportunité (motif obligatoire pour refus, modification, suspension). */
export function ModerationButtons({ id, actions }: { id: string; actions: ModAction[] }) {
  const [current, setCurrent] = useState<ModAction | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => {
        const cfg = MOD[a];
        return (
          <Button key={a} size="sm" variant={cfg.variant} onClick={() => setCurrent(a)}>
            <cfg.icon className="size-4" aria-hidden /> {cfg.label}
          </Button>
        );
      })}
      <Modal open={current !== null} onClose={() => setCurrent(null)} title={current ? MOD[current].label : ""} description="Action journalisée. L'entreprise concernée est notifiée.">
        {current && (
          <ActionForm action={moderateOpportunity} hidden={{ opportunityId: id, action: current }} onDone={() => setCurrent(null)} className="space-y-4">
            <Field label={MOD[current].reason ? "Motif (communiqué à l'entreprise)" : "Commentaire (facultatif)"} name="reason" required={MOD[current].reason}>
              {(p) => <Textarea {...p} rows={4} maxLength={2000} />}
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCurrent(null)}>
                Annuler
              </Button>
              <SubmitButton variant={MOD[current].variant === "danger" ? "danger" : "primary"}>Confirmer</SubmitButton>
            </div>
          </ActionForm>
        )}
      </Modal>
    </div>
  );
}

export function DuplicateButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Copy className="size-4" aria-hidden /> Doublon
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Marquer comme doublon" description="L'opportunité sera archivée avec un lien vers l'original.">
        <ActionForm action={markDuplicate} hidden={{ opportunityId: id }} onDone={() => setOpen(false)} className="space-y-4">
          <Field label="Identifiant de l'opportunité originale" name="duplicateOf" required hint="Copiez l'identifiant depuis l'URL /opportunites/…">
            {(p) => <Input {...p} />}
          </Field>
          <SubmitButton>Confirmer</SubmitButton>
        </ActionForm>
      </Modal>
    </>
  );
}

export function ExternalVerifyButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (s: "VERIFIED" | "UNVERIFIABLE" | "REMOVED_AT_SOURCE") =>
    start(async () => {
      const r = await verifyExternal(id, s);
      toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-1">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run("VERIFIED")}>
        Vérifiée aujourd&apos;hui
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("UNVERIFIABLE")}>
        Non vérifiable
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("REMOVED_AT_SOURCE")}>
        Retirée de la source
      </Button>
    </div>
  );
}

export function StatusWithReason({ kind, id, current }: { kind: "user" | "company"; id: string; current: string }) {
  const [open, setOpen] = useState(false);
  const next = current === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
  return (
    <>
      <Button size="sm" variant={next === "SUSPENDED" ? "ghost" : "outline"} className={next === "SUSPENDED" ? "text-red-700" : undefined} onClick={() => setOpen(true)}>
        {next === "SUSPENDED" ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        {next === "SUSPENDED" ? "Suspendre" : "Réactiver"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={next === "SUSPENDED" ? "Suspendre" : "Réactiver"} description="Action journalisée.">
        <ActionForm
          action={kind === "user" ? setUserStatus : setCompanyStatus}
          hidden={kind === "user" ? { userId: id, status: next } : { companyId: id, status: next }}
          onDone={() => setOpen(false)}
          className="space-y-4"
        >
          <Field label="Motif" name="reason" required>
            {(p) => <Textarea {...p} rows={3} maxLength={1000} />}
          </Field>
          <SubmitButton variant={next === "SUSPENDED" ? "danger" : "primary"}>Confirmer</SubmitButton>
        </ActionForm>
      </Modal>
    </>
  );
}

export function RoleSelect({ id, role, canEdit }: { id: string; role: PlatformRole; canEdit: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  if (!canEdit) return <span>{PLATFORM_ROLE_LABELS[role]}</span>;
  return (
    <select
      aria-label="Rôle"
      value={role}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          const r = await setUserRole(id, e.target.value as PlatformRole);
          toast(r.ok ? (r.message ?? "OK") : r.error, r.ok ? "success" : "error");
          router.refresh();
        })
      }
      className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
    >
      {(Object.keys(PLATFORM_ROLE_LABELS) as PlatformRole[]).map((r) => (
        <option key={r} value={r}>
          {PLATFORM_ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

export function VerifyCompanyButton({ id, verified }: { id: string; verified: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ShieldCheck className="size-4" aria-hidden /> {verified ? "Retirer la vérification" : "Vérifier"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={verified ? "Retirer la vérification" : "Marquer comme vérifiée"} description="Le badge n'est attribué qu'après un contrôle réel (SIREN, Kbis, échange avec l'entreprise).">
        <ActionForm action={verifyCompany} hidden={{ companyId: id, verified: verified ? "false" : "true" }} onDone={() => setOpen(false)} className="space-y-4">
          <Field label={verified ? "Motif (facultatif)" : "Preuve de vérification"} name="note" required={!verified}>
            {(p) => <Textarea {...p} rows={3} maxLength={1000} placeholder="ex. SIREN contrôlé sur l'annuaire officiel le …" />}
          </Field>
          <SubmitButton>Confirmer</SubmitButton>
        </ActionForm>
      </Modal>
    </>
  );
}

export function ReportResolver({ id, status }: { id: string; status: string }) {
  return (
    <ActionForm action={resolveReport} hidden={{ reportId: id }} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
      <Field label="Statut" name="status">
        {(p) => (
          <Select {...p} defaultValue={status === "OPEN" ? "REVIEWING" : status}>
            <option value="OPEN">Ouvert</option>
            <option value="REVIEWING">En cours</option>
            <option value="RESOLVED">Résolu</option>
            <option value="DISMISSED">Classé sans suite</option>
          </Select>
        )}
      </Field>
      <Field label="Note de traitement" name="note">
        {(p) => <Input {...p} maxLength={2000} />}
      </Field>
      <SubmitButton size="sm">Enregistrer</SubmitButton>
    </ActionForm>
  );
}

export function ContactHandledButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => markContactHandled(id))}>
      <Check className="size-4" aria-hidden /> Traité
    </Button>
  );
}

export function SettingToggle({ settingKey, value, field, label, hint }: { settingKey: "moderation" | "demo" | "registrations" | "security"; value: Record<string, unknown>; field: string; label: string; hint?: string }) {
  const on = Boolean(value[field]);
  return (
    <ActionForm action={updateSetting} hidden={{ key: settingKey, value: JSON.stringify({ ...value, [field]: !on }) }} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="font-semibold text-navy">{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        <span className={on ? "text-sm font-semibold text-teal-700" : "text-sm text-slate-500"}>{on ? "Activé" : "Désactivé"}</span>
        <SubmitButton size="sm" variant="outline">
          {on ? "Désactiver" : "Activer"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function MaintenanceButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runMaintenance();
            setMsg(r.ok ? (r.message ?? "OK") : r.error);
          })
        }
      >
        <Wrench className="size-4" aria-hidden /> {pending ? "Traitement…" : "Lancer les traitements maintenant"}
      </Button>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
    </div>
  );
}
