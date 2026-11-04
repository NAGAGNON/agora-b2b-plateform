"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { followBuyer } from "@/lib/buyer-follow";
import type { ActionResult } from "@/lib/validation";

/** « Suivre cet acheteur » : alerte e-mail sur ses nouveaux appels d'offres. */
export async function followBuyerAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Connectez-vous pour suivre cet acheteur." };
  const slug = String(fd.get("slug") ?? "");
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return { ok: false, error: "Acheteur introuvable." };
  const supabase = await createClient();
  const { data } = await supabase.rpc("buyer_opportunities", { p_slug: slug, p_limit: 1 });
  const name = data?.[0]?.buyer_name;
  if (!name) return { ok: false, error: "Acheteur introuvable." };
  const { count } = await supabase.from("alerts").select("id", { count: "exact", head: true }).eq("user_id", session.userId);
  if ((count ?? 0) >= 20) return { ok: false, error: "Vous avez atteint le nombre maximum d'alertes (20). Supprimez-en une dans « Alertes »." };
  const ok = await followBuyer(supabase, session.userId, name);
  if (!ok) return { ok: false, error: "L'alerte n'a pas pu être créée. Réessayez." };
  revalidatePath(`/acheteurs/${slug}`);
  revalidatePath("/dashboard/alertes");
  return { ok: true, message: `Vous suivez ${name} : ses nouveaux appels d'offres vous seront envoyés par e-mail.` };
}
