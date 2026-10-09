/**
 * Chemin interne sûr pour une redirection (`suite`, `next`) : uniquement une page du site.
 * Refuse les adresses externes et leurs variantes que les navigateurs réinterprètent
 * (« //site », « /\site », tabulations ou retours à la ligne).
 */
export function safeInternalPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  const base = "https://interne.invalid";
  try {
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
