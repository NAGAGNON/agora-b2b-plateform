"use client";

import { confirmUpload, requestUpload } from "@/app/actions/uploads";

export type UploadKind = "opportunity" | "proposal" | "message";

/**
 * Envoie des fichiers directement vers le stockage via URL signée
 * (voir src/app/actions/uploads.ts). Retourne les erreurs éventuelles par fichier.
 */
export async function uploadFiles(kind: UploadKind, parentId: string, files: File[]): Promise<{ uploaded: { path: string; name: string }[]; errors: string[] }> {
  const uploaded: { path: string; name: string }[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const meta = { kind, parentId, fileName: file.name, mime: file.type, size: file.size };
    const ticket = await requestUpload(meta);
    if (!ticket.ok || !ticket.data) {
      errors.push(ticket.ok ? `« ${file.name} » : erreur` : `« ${file.name} » : ${ticket.error}`);
      continue;
    }
    try {
      const res = await fetch(ticket.data.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type, "x-upsert": "false", apikey: ticket.data.apiKey },
        body: file,
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      errors.push(`« ${file.name} » : l'envoi a échoué.`);
      continue;
    }
    const done = await confirmUpload({ ...meta, path: ticket.data.path });
    if (done.ok && done.data) uploaded.push(done.data);
    else errors.push(done.ok ? `« ${file.name} » : erreur` : done.error);
  }
  return { uploaded, errors };
}
