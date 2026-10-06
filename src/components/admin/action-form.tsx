"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/validation";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/** Formulaire générique d'action d'administration (champs cachés + retour). */
export function ActionForm({ action, hidden, children, className, onDone }: { action: Action; hidden: Record<string, string>; children: ReactNode; className?: string; onDone?: () => void }) {
  const [state, dispatch] = useActionState(action, null);
  const router = useRouter();
  const toast = useToast();
  useEffect(() => {
    if (state?.ok) {
      toast(state.message ?? "Enregistré.");
      onDone?.();
      router.refresh();
    }
  }, [state, router, toast, onDone]);
  return (
    <form action={dispatch} className={className}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      {state && !state.ok && (
        <Notice tone="error" className="mt-2">
          {state.error}
          {state.fieldErrors && (
            <ul className="mt-1 list-disc pl-5">
              {Object.values(state.fieldErrors).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
    </form>
  );
}
