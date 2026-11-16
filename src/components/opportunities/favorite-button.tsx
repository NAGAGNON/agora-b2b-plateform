"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { toggleFavorite } from "@/app/actions/engagement";
import { useToast } from "@/components/ui/toast";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Favori. `subtle` : simple lien discret (pages où une seule action doit ressortir). */
export function FavoriteButton({ target, id, initial, signedIn, compact = false, subtle = false }: { target: "opportunity" | "company"; id: string; initial: boolean; signedIn: boolean; compact?: boolean; subtle?: boolean }) {
  const [fav, setFav] = useOptimistic(initial);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <button
      type="button"
      aria-pressed={fav}
      disabled={pending}
      onClick={() => {
        if (!signedIn) {
          router.push(`/connexion?suite=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        start(async () => {
          setFav(!fav);
          const r = await toggleFavorite(target, id);
          if (r.ok) toast(r.message ?? "OK");
          else toast(r.error, "error");
        });
      }}
      className={
        subtle
          ? cn("inline-flex items-center gap-1.5 text-sm font-semibold transition hover:text-teal-700 disabled:opacity-60", fav ? "text-teal-700" : "text-slate-500")
          : buttonClasses({ variant: "outline", size: compact ? "sm" : "md", className: cn(fav && "border-teal text-teal-700") })
      }
    >
      <Heart className={cn("size-4", fav && "fill-teal text-teal")} aria-hidden />
      {fav ? "Dans mes favoris" : "Ajouter aux favoris"}
    </button>
  );
}
