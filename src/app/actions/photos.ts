"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { actionError, logServerError } from "@/lib/errors";
import { storagePath, validateUpload } from "@/lib/files";
import { ALLOWED_LOGO_TYPES, MAX_LOGO_BYTES } from "@/lib/constants";
import type { ActionResult } from "@/lib/validation";

const MAX_COMPANY_PHOTOS = 8;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** Photo de profil : ajout ou remplacement (l'ancienne est supprimée). */
export async function updateAvatar(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Session expirée." };
  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choisissez une image.", fieldErrors: { photo: "Choisissez une image." } };
  const v = await validateUpload(file, { allowed: ALLOWED_LOGO_TYPES, maxBytes: MAX_LOGO_BYTES });
  if (!v.ok) return { ok: false, error: v.error, fieldErrors: { photo: v.error } };
  const supabase = await createClient();
  const path = storagePath(session.userId, v.file.name);
  const { error: upErr } = await supabase.storage.from("user-avatars").upload(path, v.file.bytes, { contentType: v.file.mime });
  if (upErr) {
    logServerError("avatar upload", upErr);
    return { ok: false, error: "La photo n'a pas pu être envoyée." };
  }
  const prev = session.profile.avatar_path;
  const { error } = await supabase.from("users").update({ avatar_path: path }).eq("id", session.userId);
  if (error) {
    await supabase.storage.from("user-avatars").remove([path]);
    return actionError(error);
  }
  if (prev) await supabase.storage.from("user-avatars").remove([prev]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo de profil enregistrée." };
}

/** Retire la photo de profil (les initiales s'affichent à la place). */
export async function removeAvatar(): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Session expirée." };
  const prev = session.profile.avatar_path;
  if (!prev) return { ok: true, message: "Aucune photo à retirer." };
  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ avatar_path: null }).eq("id", session.userId);
  if (error) return actionError(error);
  await supabase.storage.from("user-avatars").remove([prev]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo de profil retirée." };
}

async function companyAdmin(): Promise<{ companyId: string } | { error: string }> {
  const session = await getSession();
  const company = session?.activeCompany;
  if (!company) return { error: "Aucune entreprise active." };
  if (company.role !== "COMPANY_ADMIN") return { error: "Seul un administrateur de l'entreprise peut modifier les photos." };
  return { companyId: company.company.id };
}

/** Ajoute une ou plusieurs photos de prestations (8 au maximum par entreprise). */
export async function addCompanyPhotos(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const who = await companyAdmin();
  if ("error" in who) return { ok: false, error: who.error };
  const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, error: "Choisissez au moins une image.", fieldErrors: { photos: "Choisissez au moins une image." } };
  const caption = String(fd.get("caption") ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || null;
  const supabase = await createClient();
  const { count } = await supabase.from("company_photos").select("id", { count: "exact", head: true }).eq("company_id", who.companyId);
  const room = MAX_COMPANY_PHOTOS - (count ?? 0);
  if (room <= 0) return { ok: false, error: `${MAX_COMPANY_PHOTOS} photos au maximum : retirez-en une pour en ajouter une autre.` };
  let added = 0;
  const errors: string[] = [];
  for (const file of files.slice(0, Math.min(room, 4))) {
    const v = await validateUpload(file, { allowed: ALLOWED_LOGO_TYPES, maxBytes: MAX_PHOTO_BYTES });
    if (!v.ok) {
      errors.push(`${file.name} : ${v.error}`);
      continue;
    }
    const path = storagePath(who.companyId, v.file.name);
    const { error: upErr } = await supabase.storage.from("company-photos").upload(path, v.file.bytes, { contentType: v.file.mime });
    if (upErr) {
      logServerError("company photo upload", upErr);
      errors.push(`${file.name} : envoi impossible`);
      continue;
    }
    const { error } = await supabase.from("company_photos").insert({ company_id: who.companyId, storage_path: path, caption, position: (count ?? 0) + added });
    if (error) {
      await supabase.storage.from("company-photos").remove([path]);
      errors.push(`${file.name} : enregistrement impossible`);
      continue;
    }
    added++;
  }
  if (added) revalidatePath("/", "layout");
  const skipped = files.length - Math.min(files.length, room, 4);
  if (!added) return { ok: false, error: errors.join(" · ") || "Aucune photo n'a pu être ajoutée." };
  const notes = [...errors, ...(skipped ? [`${skipped} photo${skipped > 1 ? "s" : ""} non ajoutée${skipped > 1 ? "s" : ""} (4 par envoi, ${MAX_COMPANY_PHOTOS} au total)`] : [])];
  return { ok: true, message: `${added} photo${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""}.${notes.length ? ` ${notes.join(" · ")}` : ""}` };
}

/** Retire une photo de prestation. */
export async function removeCompanyPhoto(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const who = await companyAdmin();
  if ("error" in who) return { ok: false, error: who.error };
  const id = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Photo introuvable." };
  const supabase = await createClient();
  const { data: photo } = await supabase.from("company_photos").select("storage_path").eq("id", id).eq("company_id", who.companyId).maybeSingle();
  if (!photo) return { ok: false, error: "Photo introuvable." };
  const { error } = await supabase.from("company_photos").delete().eq("id", id).eq("company_id", who.companyId);
  if (error) return actionError(error);
  await supabase.storage.from("company-photos").remove([photo.storage_path]);
  revalidatePath("/", "layout");
  return { ok: true, message: "Photo retirée." };
}
