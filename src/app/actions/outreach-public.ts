"use server";

import { redirect } from "next/navigation";
import { recipientFromToken, unsubscribe } from "@/lib/outreach/tracking";

/** Désinscription confirmée depuis la page /desinscription/<jeton> (jeton signé vérifié). */
export async function confirmUnsubscribe(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const r = await recipientFromToken(token);
  if (r && !r.unsubscribed_at) await unsubscribe(r);
  redirect(`/desinscription/${encodeURIComponent(token)}?ok=1`);
}
