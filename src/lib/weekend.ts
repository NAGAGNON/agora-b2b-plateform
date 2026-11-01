/**
 * Pause du week-end des e-mails envoyés à l'initiative du site (prospection, veille, suivi des inscrits) :
 * samedi et dimanche, heure de Paris. Les professionnels lisent peu leurs e-mails le week-end et un
 * message reçu le samedi est noyé lundi matin. OUTREACH_WEEKEND_SENDS=1 lève la pause (tests).
 */
export function isWeekendPause(now = new Date()): boolean {
  if (process.env.OUTREACH_WEEKEND_SENDS === "1") return false;
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short" }).format(now);
  return day === "Sat" || day === "Sun";
}
