/**
 * Suivi d'une campagne de visibilité, étape par étape, pour l'administration : création, démarrage,
 * relecture de l'annonce (et message envoyé), lecture de la notification, correction par l'entreprise,
 * présentations, arrêt ou fin. Construit uniquement à partir de ce qui est enregistré.
 */
export type TimelineStep = { at: string; kind: "neutral" | "good" | "warn" | "bad"; title: string; detail?: string | null };

type Boost = { created_at: string; starts_at: string | null; ends_at: string | null; status: string };
type Log = { action: string; created_at: string; metadata: unknown };
type Note = { created_at: string; read_at: string | null; type: string };

const meta = (m: unknown) => (m && typeof m === "object" ? (m as Record<string, unknown>) : {});
const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function campaignTimeline(input: { boost: Boost; logs: Log[]; notifications: Note[]; firstPresentation: string | null; now?: Date }): TimelineStep[] {
  const { boost, logs, notifications, firstPresentation } = input;
  const now = input.now ?? new Date();
  const steps: TimelineStep[] = [{ at: boost.created_at, kind: "neutral", title: "Campagne créée par l'entreprise" }];
  const startLogged = logs.some((l) => l.action === "visibility.started_auto" || l.action === "visibility.approved");
  if (boost.starts_at && !startLogged) steps.push({ at: boost.starts_at, kind: "good", title: "Campagne démarrée" });
  for (const l of logs) {
    const m = meta(l.metadata);
    const note = typeof m.note === "string" && m.note.trim() ? m.note : null;
    switch (l.action) {
      case "visibility.started_auto":
        steps.push({ at: l.created_at, kind: "good", title: "Campagne démarrée automatiquement" });
        break;
      case "visibility.approved":
        steps.push({ at: l.created_at, kind: "good", title: "Campagne acceptée" });
        break;
      case "visibility.rejected":
        steps.push({ at: l.created_at, kind: "bad", title: "Campagne refusée", detail: note });
        break;
      case "visibility.ad_approved":
        steps.push({ at: l.created_at, kind: "good", title: "Annonce validée : les présentations par e-mail peuvent partir", detail: m.auto ? "Relue automatiquement" : null });
        break;
      case "visibility.ad_rejected":
        steps.push({ at: l.created_at, kind: "warn", title: "Annonce à corriger : message envoyé à l'entreprise", detail: note });
        break;
      case "visibility.ad_updated":
        steps.push({ at: l.created_at, kind: "neutral", title: "Annonce corrigée par l'entreprise, renvoyée en relecture" });
        break;
      case "visibility.guarantee_extended":
        steps.push({ at: l.created_at, kind: "neutral", title: `Campagne prolongée gratuitement de ${Number(m.days) || 0} jour(s)`, detail: "Le nombre de présentations prévu n'était pas atteint." });
        break;
      case "visibility.stopped":
        steps.push({ at: l.created_at, kind: "bad", title: "Campagne arrêtée", detail: note });
        break;
    }
  }
  for (const n of notifications) {
    steps.push({
      at: n.created_at,
      kind: n.read_at ? "good" : "neutral",
      title: n.type === "visibility_ad_approved" ? "Notification « annonce validée » envoyée sur le site" : "Notification « annonce à corriger » envoyée sur le site",
      detail: n.read_at ? `Lue le ${fmt(n.read_at)}` : "Pas encore lue",
    });
  }
  if (firstPresentation) steps.push({ at: firstPresentation, kind: "good", title: "Première présentation de l'entreprise" });
  if (boost.ends_at) {
    const past = new Date(boost.ends_at) <= now;
    steps.push({ at: boost.ends_at, kind: "neutral", title: past ? "Campagne terminée" : "Fin prévue de la campagne" });
  }
  return steps.sort((a, b) => a.at.localeCompare(b.at));
}

/** Prochaine étape attendue, en une phrase, pour savoir tout de suite où en est la campagne. */
export function campaignNextStep(b: { status: string; ad_status: string | null; ad_title: string | null }): string {
  if (b.status === "PENDING") return "En attente de démarrage.";
  if (b.status === "CANCELLED") return "Campagne arrêtée : rien ne part.";
  if (b.status === "REJECTED") return "Campagne non retenue : rien ne part.";
  if (b.status === "ENDED") return "Campagne terminée.";
  if (!b.ad_title) return "Pas d'annonce : présentations dans l'espace des membres uniquement.";
  if (b.ad_status === "PENDING_REVIEW") return "Annonce en attente de relecture : aucun e-mail ne part encore.";
  if (b.ad_status === "REJECTED") return "En attente de la correction de l'annonce par l'entreprise : aucun e-mail ne part.";
  if (b.ad_status === "APPROVED") return "Annonce validée : les présentations partent chaque jour.";
  return "En cours.";
}
