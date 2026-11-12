import { Award } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

/** Membre pionnier : rappel discret de la récompense (Pro offert jusqu'à une date). */
export async function PioneerBadge({ userId, now }: { userId: string; now: number }) {
  const { data } = await (await createClient()).from("pioneer_rewards").select("pro_until, applied_company_id").eq("user_id", userId).maybeSingle();
  if (!data || new Date(data.pro_until).getTime() < now) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-gradient-to-r from-teal-50 to-sky px-4 py-3 text-sm text-navy ring-1 ring-teal/30">
      <Award className="size-4 shrink-0 text-teal-700" aria-hidden />
      <span className="flex-1">
        <strong>Membre pionnier</strong> : merci pour votre fidélité ! L&apos;offre Pro vous est offerte jusqu&apos;au {formatDate(data.pro_until)}
        {data.applied_company_id ? "." : " (elle s'active dès que vous créez votre entreprise)."}
      </span>
    </p>
  );
}
