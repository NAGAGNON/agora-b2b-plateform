// Mêmes règles que la fonction SQL public.buyer_slug (lien d'une annonce vers la page de son acheteur)
const FROM = "àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ'’-";
const TO = "aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY   ";

export function buyerSlug(name: string | null | undefined): string | null {
  const translated = [...(name ?? "").trim()].map((c) => {
    const i = FROM.indexOf(c);
    return i === -1 ? c : TO[i];
  }).join("");
  const slug = translated.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/^-+|-+$/g, "");
  return slug || null;
}
