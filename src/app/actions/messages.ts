"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { userMessage, logServerError } from "@/lib/errors";
import { storagePath, validateUpload } from "@/lib/files";
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
  if (error || !data) return { ok: false, error: userMessage(error) };
  await supabase.rpc("track_event", { p_event_name: "contact_company", p_properties: { opportunity_id: parsed.data.opportunityId } });
  redirect(`/dashboard/messages/${data}`);
}

export async function sendMessage(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(messageSchema, fd);
  if (!parsed.success) return parsed.result;
  const supabase = await createClient();
  const { conversationId, body } = parsed.data;
  let attachmentPath: string | undefined;
  let attachmentName: string | undefined;
  const file = fd.get("attachment");
  if (file instanceof File && file.size > 0) {
    const v = await validateUpload(file);
    if (!v.ok) return { ok: false, error: v.error };
    attachmentPath = storagePath(conversationId, v.file.name);
    attachmentName = v.file.name;
    const { error } = await supabase.storage.from("message-attachments").upload(attachmentPath, v.file.bytes, { contentType: v.file.mime });
    if (error) {
      logServerError("attachment upload", error);
      return { ok: false, error: "La pièce jointe n'a pas pu être envoyée." };
    }
  }
  const { error } = await supabase.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: body,
    p_attachment_path: attachmentPath,
    p_attachment_name: attachmentName,
  });
  if (error) return { ok: false, error: userMessage(error) };
  flushEmailsAfterResponse();
  revalidatePath(`/dashboard/messages/${conversationId}`);
  revalidatePath("/dashboard/messages");
  return { ok: true };
}
