"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteAlert, deleteSavedSearch, setAlertActive, toggleFavorite } from "@/app/actions/engagement";
import { useToast } from "@/components/ui/toast";

export function RemoveFavoriteButton({ target, id }: { target: "opportunity" | "company"; id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await toggleFavorite(target, id);
          toast(r.ok ? "Retiré des favoris." : r.error, r.ok ? "success" : "error");
          router.refresh();
        })
      }
      className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
      aria-label="Retirer des favoris"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

export function DeleteSavedSearchButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => deleteSavedSearch(id))} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer la recherche">
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

export function AlertControls({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={active} disabled={pending} onChange={(e) => start(() => setAlertActive(id, e.target.checked))} className="size-4 accent-teal" />
        Active
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={() => confirm("Supprimer cette alerte ?") && start(() => deleteAlert(id))}
        className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
        aria-label="Supprimer l'alerte"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}
