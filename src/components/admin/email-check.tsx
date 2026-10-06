"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { sendTestEmails, type EmailCheckRow } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

/** Envoie chaque modèle à l'administrateur connecté et affiche le résultat (liens, statut, idempotence). */
export function EmailCheck({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string; rows?: EmailCheckRow[] } | null>(null);
  return (
    <div className="space-y-3">
      <Button
        disabled={pending || !enabled}
        title={enabled ? undefined : "Aucun fournisseur e-mail configuré"}
        onClick={() =>
          start(async () => {
            const r = await sendTestEmails();
            setResult(r.ok ? { ok: true, text: r.message ?? "Terminé", rows: r.data?.rows } : { ok: false, text: r.error });
          })
        }
      >
        <Send className="size-4" aria-hidden /> Envoyer les modèles de contrôle à mon adresse
      </Button>
      {pending && <p className="text-xs text-slate-500" role="status">Envoi en cours…</p>}
      {result && (
        <Notice tone={result.ok && result.rows?.every((r) => r.status === "SENT" || r.status === "OK") ? "success" : result.ok ? "info" : "error"}>
          {result.text}
          {result.rows && (
            <table className="mt-2 w-full text-left text-xs">
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.key} className="border-t border-slate-200">
                    <td className="py-1 pr-2">{r.label}</td>
                    <td className="py-1 pr-2 font-semibold">{r.status}</td>
                    <td className="break-all py-1 text-slate-500">{r.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Notice>
      )}
    </div>
  );
}
