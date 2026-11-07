"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { toggleFollow } from "@/app/actions/follows";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

/** Suivre une entreprise : ses nouveaux besoins arrivent dans les notifications de l'entreprise abonnée. */
export function FollowButton({ companyId, initial, signedIn, followers = 0 }: { companyId: string; initial: boolean; signedIn: boolean; followers?: number }) {
  const [following, setFollowing] = useOptimistic(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const shown = followers + (following && !initial ? 1 : 0) - (!following && initial ? 1 : 0);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        aria-pressed={following}
        disabled={pending}
        onClick={() => {
          if (!signedIn) {
            router.push(`/inscription?suite=${encodeURIComponent(window.location.pathname)}`);
            return;
          }
          start(async () => {
            setFollowing(!following);
            const r = await toggleFollow(companyId);
            if (r.ok) {
              toast(r.message ?? "OK");
              router.refresh();
            } else toast(r.error, "error");
          });
        }}
        className={cn(
          "group inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition duration-300 active:scale-95",
          following
            ? "bg-teal-50 text-teal-800 ring-1 ring-teal/40 hover:bg-red-50 hover:text-red-700 hover:ring-red-200"
            : "btn-shine bg-gradient-to-r from-navy to-navy-900 text-white shadow-lg hover:-translate-y-px hover:shadow-xl",
        )}
      >
        {following ? (
          <>
            <Check className="size-4 group-hover:hidden" aria-hidden />
            <span className="group-hover:hidden">Abonné</span>
            <span className="hidden group-hover:inline">Ne plus suivre</span>
          </>
        ) : (
          <>
            <Plus className="size-4 transition group-hover:rotate-90" aria-hidden /> Suivre
          </>
        )}
      </button>
      {shown > 0 && (
        <span className="text-sm text-slate-500">
          <strong className="text-navy">{shown}</strong> entreprise{shown > 1 ? "s" : ""} abonnée{shown > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
