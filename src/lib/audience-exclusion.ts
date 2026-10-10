/**
 * Visites internes exclues de la mesure d'audience : comptes de l'équipe (modération,
 * administration) et adresses du propriétaire (AUDIENCE_EXCLUDED_EMAILS, ainsi que
 * DAILY_REPORT_EMAIL, l'adresse personnelle qui reçoit le rapport du soir).
 * Une fois reconnu, l'appareil est marqué par un cookie : ses visites restent exclues
 * même après déconnexion.
 */
export const INTERNAL_VISIT_COOKIE = "lp_interne";
export const INTERNAL_VISIT_MAX_AGE = 400 * 24 * 3600; // durée maximale admise par les navigateurs

export function excludedEmails(): Set<string> {
  const raw = `${process.env.AUDIENCE_EXCLUDED_EMAILS ?? ""},${process.env.DAILY_REPORT_EMAIL ?? ""}`;
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x.includes("@")),
  );
}

export function isInternalVisitor(user: { platform_role: string; email: string | null } | null | undefined): boolean {
  if (!user) return false;
  return user.platform_role !== "USER" || (user.email !== null && excludedEmails().has(user.email.toLowerCase()));
}
