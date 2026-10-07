"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { actionError } from "@/lib/errors";
import { flushEmailsAfterResponse } from "@/lib/email/flush";
import { messageSchema, parseForm, type ActionResult } from "@/lib/validation";

const startSchema = z.object({
  opportunityId: z.uuid(),
  supplierCompanyId: z.uuid(),
  body: z.string().trim().min(1, "Message vide").max(5000),
});

/** Ouvre (ou reprend) la conversation liée à une opportunité — règles vérifiées en base. */
export async function startConversation(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(startSchema, fd);
  if (!parsed.success) return parsed.result;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_conversation", {
    p_opportunity_id: parsed.data.opportunityId,
    p_supplier_company_id: parsed.data.supplierCompanyId,
    p_body: parsed.data.body,
  });
  if (error || !data) return actionError(error);
  await supabase.rpc("track_event", { p_event_name: "contact_company", p_properties: { opportunity_id: parsed.data.opportunityId } });
  redirect(`/dashboard/messages/${data}`);
}

export async function sendMessage(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(messageSchema, fd);
  if (!parsed.success) return parsed.result;
  const supabase = await createClient();
  const { conversationId, body } = parsed.data;
  // Pièce jointe déjà envoyée au stockage et vérifiée (voir actions/uploads.ts).
  const attachmentPath = typeof fd.get("attachmentPath") === "string" && fd.get("attachmentPath") ? String(fd.get("attachmentPath")) : undefined;
  const attachmentName = attachmentPath ? String(fd.get("attachmentName") ?? "piece-jointe").slice(0, 200) : undefined;
  const { error } = await supabase.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: body,
    p_attachment_path: attachmentPath,
    p_attachment_name: attachmentName,
  });
  if (error) return actionError(error);
  flushEmailsAfterResponse();
  revalidatePath(`/dashboard/messages/${conversationId}`);
  revalidatePath("/dashboard/messages");
  return { ok: true };
}
