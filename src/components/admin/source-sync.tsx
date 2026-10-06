"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, RefreshCw, Settings2 } from "lucide-react";
import { syncSourceNow, testSource, updateSourceSettings } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";

/** Boutons de collecte d'une source : synchronisation, test, réglages. */
export function SourceSyncControls({
  id,
  name,
  approved,
  automated,
  isActive,
  frequency,
  config,
}: {
  id: string;
  name: string;
  approved: boolean;
  automated: boolean;
  isActive: boolean;
  frequency: string;
  config: unknown;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string; sample?: unknown } | null>(null);
  const [settings, setSettings] = useState(false);
  const router = useRouter();
  if (!automated) return <p className="text-xs text-slate-500">Référencement manuel (Opportunités → Référencer une opportunité externe).</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending || !approved}
          title={approved ? undefined : "Source non approuvée"}
          onClick={() =>
            start(async () => {
              const r = await syncSourceNow(id);
              setResult({ ok: r.ok, text: r.ok ? (r.message ?? "Terminé") : r.error });
              router.refresh();
            })
          }
        >
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} aria-hidden /> Synchroniser maintenant
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await testSource(id);
              setResult({ ok: r.ok, text: r.ok ? (r.message ?? "Test réussi") : r.error, sample: r.ok ? r.data?.sample : undefined });
              router.refresh();
            })
          }
        >
          <FlaskConical className="size-4" aria-hidden /> Tester la collecte
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSettings(true)}>
          <Settings2 className="size-4" aria-hidden /> Réglages
        </Button>
      </div>
      {pending && <p className="text-xs text-slate-500" role="status">Collecte en cours, cela peut prendre jusqu&apos;à une minute…</p>}
      {result && (
        <Notice tone={result.ok ? "success" : "error"}>
          {result.text}
          {result.sample !== undefined && result.sample !== null && (
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold">Échantillon normalisé</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded bg-white p-2 text-[11px] text-slate-700">{JSON.stringify(result.sample, null, 2)}</pre>
            </details>
          )}
        </Notice>
      )}
      <Modal open={settings} onClose={() => setSettings(false)} title={`Collecte : ${name}`} className="max-w-2xl">
        <ActionForm action={updateSourceSettings} hidden={{ id }} onDone={() => setSettings(false)} className="space-y-4">
          <Checkbox name="isActive" defaultChecked={isActive} disabled={!approved} label="Collecte automatique active" hint={approved ? "Exécutée par la tâche planifiée." : "Approuvez d'abord la source (validation juridique)."} />
          <Field label="Fréquence" name="syncFrequency">
            {(p) => (
              <Select {...p} defaultValue={frequency}>
                <option value="daily">Quotidienne</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="hourly">Horaire (nécessite un plan Vercel avec crons fréquents)</option>
              </Select>
            )}
          </Field>
          <Field label="Configuration (JSON)" name="config" hint="Départements, zones NUTS, fenêtre initiale (lookbackDays), volume maximal (maxRecords), correspondance des champs (fieldMap)…">
            {(p) => <Textarea {...p} rows={10} className="font-mono text-xs" defaultValue={JSON.stringify(config ?? {}, null, 2)} />}
          </Field>
          <SubmitButton>Enregistrer</SubmitButton>
        </ActionForm>
      </Modal>
    </div>
  );
}
