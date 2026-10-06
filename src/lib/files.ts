import { ALLOWED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "@/lib/constants";

const ZIP_BASED = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
]);

/** Vérifie la signature binaire (magic bytes) pour éviter un type MIME usurpé. */
export function matchesSignature(mime: string, bytes: Uint8Array): boolean {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (mime === "application/pdf") return starts(0x25, 0x50, 0x44, 0x46); // %PDF
  if (mime === "image/png") return starts(0x89, 0x50, 0x4e, 0x47);
  if (mime === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (mime === "image/webp")
    return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (ZIP_BASED.has(mime)) return starts(0x50, 0x4b, 0x03, 0x04);
  return false;
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "fichier";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-100);
  return cleaned || "fichier";
}

export type ValidatedFile = { bytes: Uint8Array; mime: string; name: string; size: number };

export async function validateUpload(
  file: File,
  opts: { allowed?: string[]; maxBytes?: number } = {},
): Promise<{ ok: true; file: ValidatedFile } | { ok: false; error: string }> {
  const allowed = opts.allowed ?? Object.keys(ALLOWED_DOCUMENT_TYPES);
  const maxBytes = opts.maxBytes ?? MAX_DOCUMENT_BYTES;
  if (!file || file.size === 0) return { ok: false, error: "Fichier vide." };
  if (file.size > maxBytes) return { ok: false, error: `Fichier trop volumineux (maximum ${Math.round(maxBytes / 1024 / 1024)} Mo).` };
  if (!allowed.includes(file.type)) return { ok: false, error: "Type de fichier non autorisé." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesSignature(file.type, bytes)) return { ok: false, error: "Le contenu du fichier ne correspond pas à son type." };
  return { ok: true, file: { bytes, mime: file.type, name: sanitizeFileName(file.name), size: file.size } };
}

export function storagePath(parentId: string, fileName: string): string {
  return `${parentId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}
