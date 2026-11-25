import { getSession } from "@/lib/auth";
import { ContactTeam } from "@/components/contact-team";

/** Bouton « Contacter l'équipe », prérempli avec le nom et l'e-mail du membre connecté. */
export async function ContactTeamButton({ context, className }: { context?: string; className?: string }) {
  const s = await getSession();
  return (
    <ContactTeam
      name={s?.profile.full_name ?? null}
      email={s?.email ?? null}
      company={s?.activeCompany?.company.name ?? null}
      context={context}
      className={className}
    />
  );
}
