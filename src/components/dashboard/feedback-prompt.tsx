import Link from "next/link";
import { MessageSquareQuote } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

const DAY = 86_400_000;

/**
 * Petit encart discret en bas du tableau de bord : inviter à donner son avis. Seulement pour les
 * membres inscrits depuis 3 jours ou plus, et plus jamais une fois l'avis donné.
 */
export async function FeedbackPrompt({ userId, createdAt, now }: { userId: string; createdAt: string; now: number }) {
  if (now - new Date(createdAt).getTime() < 3 * DAY) return null;
  const { count } = await createAdminClient().from("testimonials").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (count) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
      <MessageSquareQuote className="size-4 shrink-0 text-teal-700" aria-hidden />
      <span className="flex-1">Notez LinkProB2B en quelques étoiles : votre avis nous aide à améliorer le site.</span>
      <Link href="/avis" className="font-semibold text-teal-700 hover:underline">
        Donner mon avis (1 min)
      </Link>
    </p>
  );
}
