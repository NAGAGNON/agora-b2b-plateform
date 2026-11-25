/**
 * Visite réelle depuis un e-mail de prospection : la personne a cliqué ET agi sur le site
 * (au moins 2 pages vues dans le parcours, ou une action : clic « Créer mon compte » / « Se connecter »,
 * inscription, connexion, accès à l'offre, conversion). Un lien ouvert par un robot de messagerie
 * (une seule page, aucune action) n'est jamais compté.
 */
const ACTIONS = new Set(["GATE_SIGNUP_CLICK", "GATE_LOGIN_CLICK", "SIGNUP", "LOGIN", "OFFER_ACCESS", "CONVERSION"]);
const PAGES = new Set(["LANDING_VIEW", "OPPORTUNITY_VIEW", "GATE_VIEW"]);

export function humanVisitors(events: { recipient_id: string | null; type: string }[]): Set<string> {
  const pages = new Map<string, number>();
  const out = new Set<string>();
  for (const e of events) {
    if (!e.recipient_id) continue;
    if (ACTIONS.has(e.type)) out.add(e.recipient_id);
    else if (PAGES.has(e.type)) {
      const n = (pages.get(e.recipient_id) ?? 0) + 1;
      pages.set(e.recipient_id, n);
      if (n >= 2) out.add(e.recipient_id);
    }
  }
  return out;
}
