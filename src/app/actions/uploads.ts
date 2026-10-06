"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { logServerError, userMessage } from "@/lib/errors";
import { matchesSignature, sanitizeFileName, storagePath } from "@/lib/files";
import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/constants";
import type { ActionResult } from "@/lib/validation";

/**
 * Envoi de fichiers en deux temps, sans faire transiter le fichier par le serveur
 * applicatif (limite de 4,5 Mo par requête sur Vercel) :
 *  1. requestUpload : vérifie type/taille et obtient une URL d'envoi signée. La
 *     création de cette URL est soumise aux politiques de stockage (RLS) de
 *     l'utilisateur : impossible pour un dossier sur lequel il n'a pas de droits.
 *  2. Le navigateur envoie le fichier directement au stockage.
 *  3. confirmUpload : relit le fichier, contrôle sa signature binaire et sa taille,
 *     le supprime s'il est invalide, puis l'enregistre.
 */
const KINDS = {
  opportunity: "opportunity-documents",
  proposal: "proposal-documents",
  message: "message-attachments",
} as const;
type Kind = keyof typeof KINDS;

const metaSchema = z.object({
  kind: z.enum(["opportunity", "proposal", "message"]),
  parentId: z.uuid(),
  fileName: z.string().min(1).max(200),
  mime: z.string().refine((m) => m in ALLOWED_DOCUMENT_TYPES, "Type de fichier non autorisé."),
  size: z.number().int().positive().max(MAX_DOCUMENT_BYTES, "Fichier trop volumineux (10 Mo maximum)."),
});

export type UploadTicket = { path: string; signedUrl: string; apiKey: string };

export async function requestUpload(input: z.input<typeof metaSchema>): Promise<ActionResult<UploadTicket>> {
  const parsed = metaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Fichier invalide." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };
  const { kind, parentId, fileName } = parsed.data;
  if (kind === "opportunity") {
    const { count } = await supabase.from("opportunity_documents").select("id", { count: "exact", head: true }).eq("opportunity_id", parentId);
    if ((count ?? 0) >= 10) return { ok: false, error: "10 documents maximum par opportunité." };
  }
  const path = storagePath(parentId, fileName);
  const { data, error } = await supabase.storage.from(KINDS[kind]).createSignedUploadUrl(path);
  if (error || !data) {
    logServerError("requestUpload", error);
    return { ok: false, error: "Vous n'avez pas les droits pour ajouter un fichier ici." };
  }
  return { ok: true, data: { path, signedUrl: data.signedUrl, apiKey: env.supabasePublishableKey } };
}

const confirmSchema = metaSchema.extend({ path: z.string().min(10).max(400) });

export async function confirmUpload(input: z.input<typeof confirmSchema>): Promise<ActionResult<{ path: string; name: string }>> {
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Fichier invalide." };
  const { kind, parentId, path, mime, fileName } = parsed.data;
  if (!path.startsWith(`${parentId}/`)) return { ok: false, error: "Chemin invalide." };
  const supabase = await createClient();
  const bucket = KINDS[kind as Kind];
  const { data: blob, error } = await supabase.storage.from(bucket).download(path);
  if (error || !blob) return { ok: false, error: "Fichier introuvable après envoi." };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_DOCUMENT_BYTES || !matchesSignature(mime, bytes)) {
    await createAdminClient().storage.from(bucket).remove([path]);
    return { ok: false, error: `« ${fileName} » : le contenu ne correspond pas au type annoncé ou dépasse 10 Mo.` };
  }
  const name = sanitizeFileName(fileName);
  if (kind === "opportunity") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: e } = await supabase.from("opportunity_documents").insert({
      opportunity_id: parentId,
      storage_path: path,
      file_name: name,
      mime_type: mime,
      size_bytes: bytes.byteLength,
      uploaded_by: user!.id,
    });
    if (e) {
      await createAdminClient().storage.from(bucket).remove([path]);
      return { ok: false, error: userMessage(e) };
    }
    revalidatePath(`/dashboard/opportunites/${parentId}`);
  } else if (kind === "proposal") {
    const { error: e } = await supabase.rpc("register_proposal_document", {
      p_proposal_id: parentId,
      p_storage_path: path,
      p_file_name: name,
      p_mime_type: mime,
      p_size_bytes: bytes.byteLength,
    });
    if (e) {
      await createAdminClient().storage.from(bucket).remove([path]);
      return { ok: false, error: userMessage(e) };
    }
  }
  return { ok: true, data: { path, name } };
}
