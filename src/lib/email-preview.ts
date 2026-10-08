/**
 * Aperçu d'un e-mail dans le tableau de bord (iframe) : les liens s'ouvrent dans un nouvel
 * onglet, comme dans une messagerie. Sans cela, le lien tenterait de s'ouvrir DANS l'aperçu,
 * ce que le site refuse par sécurité (protection contre l'affichage en cadre).
 */
export function previewHtml(html: string): string {
  const base = '<base target="_blank">';
  return /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, `<head$1>${base}`) : `${base}${html}`;
}

/** Autorisations de l'iframe d'aperçu : uniquement l'ouverture des liens dans un nouvel onglet (pas de script). */
export const PREVIEW_SANDBOX = "allow-popups allow-popups-to-escape-sandbox";
