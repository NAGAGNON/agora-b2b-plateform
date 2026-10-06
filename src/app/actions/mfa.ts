"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/validation";

/** Démarre l'enrôlement TOTP (application d'authentification). */
export async function enrollTotp(): Promise<ActionResult<{ factorId: string; qr: string; secret: string }>> {
  const supabase = await createClient();
  // Nettoie les facteurs non vérifiés d'une tentative précédente.
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `LinkProB2B ${Date.now()}` });
  if (error || !data) return { ok: false, error: "L'activation n'a pas pu démarrer." };
  return { ok: true, data: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret } };
}

const codeSchema = z.object({ factorId: z.uuid(), code: z.string().regex(/^\d{6}$/, "Code à 6 chiffres") });

export async function verifyTotp(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = codeSchema.safeParse({ factorId: fd.get("factorId"), code: fd.get("code") });
  if (!parsed.success) return { ok: false, error: "Code invalide (6 chiffres)." };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: parsed.data.factorId, code: parsed.data.code });
  if (error) return { ok: false, error: "Code incorrect ou expiré." };
  const next = String(fd.get("suite") ?? "");
  if (next.startsWith("/") && !next.startsWith("//")) redirect(next);
  return { ok: true, message: "Double authentification activée et vérifiée." };
}

export async function disableTotp(factorId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(factorId).success) return { ok: false, error: "Identifiant invalide." };
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, error: "Désactivation impossible : reconnectez-vous avec votre code puis réessayez." };
  return { ok: true, message: "Double authentification désactivée." };
}
