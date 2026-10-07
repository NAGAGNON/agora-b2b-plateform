"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { articleAction, generateArticleNow, updateArticleSettings } from "@/app/actions/articles";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/notice";

export function GenerateArticleButton({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  return (
    <div className="space-y-2">
      <Button
        disabled={pending || !enabled}
        title={enabled ? undefined : "ANTHROPIC_API_KEY absente"}
        onClick={() =>
          start(async () => {
            const r = await generateArticleNow();
            setResult({ ok: r.ok, text: r.ok ? (r.message ?? "Terminé") : r.error });
            router.refresh();
          })
        }
      >
        <Sparkles className="size-4" aria-hidden /> Rédiger un brouillon maintenant
      </Button>
      {pending && <p className="text-xs text-slate-500" role="status">Rédaction en cours (jusqu&apos;à une minute)…</p>}
      {result && <Notice tone={result.ok ? "success" : "error"}>{result.text}</Notice>}
    </div>
  );
}

export function ArticleSettingsForm({ enabled, autoPublish, perDay }: { enabled: boolean; autoPublish: boolean; perDay: number }) {
  return (
    <ActionForm action={updateArticleSettings} hidden={{}} className="space-y-4">
      <Checkbox name="enabled" defaultChecked={enabled} label="Rédaction automatique quotidienne" hint="Chaque matin, après la collecte des marchés." />
      <Checkbox
        name="autoPublish"
        defaultChecked={autoPublish}
        label="Publier automatiquement les articles conformes"
        hint="Un article dont un chiffre n'est pas retrouvé dans les données reste toujours en brouillon."
      />
      <Field label="Articles par jour" name="perDay">
        {(p) => (
          <Select {...p} defaultValue={String(perDay)}>
            <option value="1">1 (recommandé)</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </Select>
        )}
      </Field>
      <SubmitButton>Enregistrer</SubmitButton>
    </ActionForm>
  );
}

export function ArticleRowActions({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "PUBLISHED" ? (
        <ActionForm action={articleAction} hidden={{ id, action: "publish" }}>
          <SubmitButton size="sm">Publier</SubmitButton>
        </ActionForm>
      ) : (
        <ActionForm action={articleAction} hidden={{ id, action: "unpublish" }}>
          <SubmitButton size="sm" variant="outline">
            Dépublier
          </SubmitButton>
        </ActionForm>
      )}
      <ActionForm action={articleAction} hidden={{ id, action: "delete" }}>
        <SubmitButton size="sm" variant="ghost">
          Supprimer
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
