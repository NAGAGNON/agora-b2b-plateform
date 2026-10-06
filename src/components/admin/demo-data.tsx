"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Database, Trash2 } from "lucide-react";
import { loadDemoData, removeDemoData } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { DemoCredential } from "@/lib/demo/seed";

/** Chargement / suppression du jeu de démonstration (prévisualisation uniquement). */
export function DemoDataControls({ allowed, present }: { allowed: boolean; present: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string; creds?: DemoCredential[] } | null>(null);
  const router = useRouter();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!allowed || pending}
          title={allowed ? undefined : "Impossible en production"}
          onClick={() => {
            if (!confirm("Recréer le jeu de démonstration ? L'ancien jeu (comptes, entreprises, opportunités fictives) sera supprimé.")) return;
            start(async () => {
              const r = await loadDemoData();
              setResult(r.ok ? { ok: true, text: r.message ?? "Terminé", creds: r.data?.creds } : { ok: false, text: r.error });
              router.refresh();
            });
          }}
        >
          <Database className="size-4" aria-hidden /> {present ? "Recréer les données de démonstration" : "Charger les données de démonstration"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!present || pending}
          onClick={() => {
            if (!confirm("Supprimer définitivement toutes les données de démonstration ? Les données réelles ne sont pas touchées.")) return;
            start(async () => {
              const r = await removeDemoData();
              setResult(r.ok ? { ok: true, text: r.message ?? "Terminé" } : { ok: false, text: r.error });
              router.refresh();
            });
          }}
        >
          <Trash2 className="size-4" aria-hidden /> Supprimer les données de démonstration
        </Button>
      </div>
      {pending && <p role="status" className="text-xs text-slate-500">Traitement en cours…</p>}
      {result && (
        <Notice tone={result.ok ? "success" : "error"}>
          {result.text}
          {result.creds && (
            <div className="mt-2 overflow-x-auto">
              <p className="font-semibold">Comptes fictifs (affichés une seule fois — notez-les) :</p>
              <table className="mt-1 text-xs">
                <tbody>
                  {result.creds.map((c) => (
                    <tr key={c.email}>
                      <td className="pr-3">{c.label}</td>
                      <td className="pr-3 font-mono">{c.email}</td>
                      <td className="font-mono">{c.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Notice>
      )}
    </div>
  );
}
