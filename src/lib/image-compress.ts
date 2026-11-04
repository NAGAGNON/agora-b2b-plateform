/**
 * Réduction d'une photo dans le navigateur avant l'envoi : 1 600 pixels au plus sur le grand
 * côté, format WebP (JPEG si le navigateur ne sait pas l'écrire). Les envois restent légers
 * (limite de 4 Mo par envoi) et les pages s'affichent vite. En cas d'échec, le fichier d'origine
 * est conservé.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    const out = blob && blob.type === "image/webp" ? blob : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!out || out.size >= file.size) return file;
    const ext = out.type === "image/webp" ? "webp" : "jpg";
    return new File([out], `${file.name.replace(/\.[^.]+$/, "") || "photo"}.${ext}`, { type: out.type });
  } catch {
    return file;
  }
}

/** Remplace les fichiers choisis dans un champ par leurs versions réduites. */
export async function compressInput(input: HTMLInputElement, max = Infinity): Promise<File[]> {
  const files = Array.from(input.files ?? []).slice(0, max);
  const out = await Promise.all(files.map((f) => compressImage(f)));
  try {
    const dt = new DataTransfer();
    out.forEach((f) => dt.items.add(f));
    input.files = dt.files;
  } catch {
    /* navigateur ancien : les fichiers d'origine sont envoyés */
  }
  return out;
}
