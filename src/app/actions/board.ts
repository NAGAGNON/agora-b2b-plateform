"use server";

import { revalidatePath } from "next/cache";
import { getStaffActionSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { founderDecide, runBoard } from "@/lib/board";
import { BOARD_VERDICTS, verifyBoardDecisionToken, type BoardVerdict } from "@/lib/board-token";
import type { ActionResult } from "@/lib/validation";

const LABEL: Record<BoardVerdict, string> = { VALIDEE: "Décision validée.", REFUSEE: "Décision refusée.", PLUS_INFO: "Plus d'informations demandées au comité." };

/** Réponse du fondateur depuis l'administration. */
export async function decideBoardDecision(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getStaffActionSession();
  if (!session?.isAdmin) return { ok: false, error: "Réservé aux administrateurs." };
  const id = String(fd.get("id") ?? "");
  const verdict = String(fd.get("verdict") ?? "") as BoardVerdict;
  if (!/^[0-9a-f-]{36}$/.test(id) || !BOARD_VERDICTS.includes(verdict)) return { ok: false, error: "Choix invalide." };
  try {
    const r = await founderDecide({ decisionId: id, verdict, comment: String(fd.get("comment") ?? ""), founderId: session.userId, via: "admin" });
    revalidatePath("/admin/comite");
    return r.ok ? { ok: true, message: LABEL[verdict] } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: "Enregistrement impossible pour le moment." };
  }
}

/** Réponse du fondateur depuis le lien de l'e-mail (page de confirmation, jeton signé). */
export async function confirmBoardDecisionFromEmail(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const t = verifyBoardDecisionToken(String(fd.get("t") ?? ""));
  if (!t) return { ok: false, error: "Ce lien n'est plus valable. Répondez depuis l'administration." };
  if (!(await rateLimit("board-email-decision", 30, 3600))) return { ok: false, error: "Trop de tentatives. Réessayez plus tard." };
  try {
    const r = await founderDecide({ decisionId: t.decisionId, verdict: t.verdict, comment: String(fd.get("comment") ?? ""), founderId: null, via: "email" });
    return r.ok ? { ok: true, message: LABEL[t.verdict] } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: "Enregistrement impossible pour le moment." };
  }
}

/** Réunir le comité maintenant (réunion exceptionnelle à la demande du fondateur). */
export async function convokeBoard(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getStaffActionSession();
  if (!session?.isAdmin) return { ok: false, error: "Réservé aux administrateurs." };
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 500);
  if (reason.length < 5) return { ok: false, error: "Indiquez en quelques mots le sujet de la réunion." };
  if (!(await rateLimit("board-convoke", 4, 3600))) return { ok: false, error: "4 réunions par heure au maximum." };
  try {
    const r = await runBoard({ kind: "EXCEPTIONNELLE", reason });
    revalidatePath("/admin/comite");
    if ("skipped" in r) return { ok: false, error: r.skipped ?? "Réunion impossible." };
    const mailed = r.mail && "sent" in r.mail && r.mail.sent > 0;
    return { ok: true, message: `Réunion terminée : ${r.proposals} proposition(s), ${r.toValidate} à valider.${mailed ? " Le bilan vous a été envoyé par e-mail." : ""}` };
  } catch {
    return { ok: false, error: "La réunion n'a pas pu se tenir. Réessayez dans un instant." };
  }
}
