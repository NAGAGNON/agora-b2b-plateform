/**
 * Brouillon de besoin rédigé AVANT la création du compte (page Publier) : conservé dans ce
 * navigateur seulement, puis repris automatiquement dans l'assistant de publication.
 */
export type NeedDraft = { title: string; description: string; sector: string; city: string; savedAt: string };

const KEY = "linkprob2b.need-draft";
const MAX_AGE_MS = 14 * 86_400_000;

export function saveNeedDraft(d: Omit<NeedDraft, "savedAt">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...d, savedAt: new Date().toISOString() }));
  } catch {
    // navigation privée ou stockage bloqué : le visiteur ressaisira son besoin
  }
}

export function readNeedDraft(): NeedDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as NeedDraft;
    if (!d.title || Date.now() - new Date(d.savedAt).getTime() > MAX_AGE_MS) return null;
    return d;
  } catch {
    return null;
  }
}

export function clearNeedDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // rien à faire
  }
}
