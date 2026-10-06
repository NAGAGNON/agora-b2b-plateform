import { ErrorState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata = { ...PRIVATE_METADATA, title: "Compte suspendu" };

export default function SuspendedPage() {
  return (
    <div className="container-page max-w-2xl py-16">
      <ErrorState
        title="Votre compte est suspendu"
        description="L'accès à votre espace est temporairement suspendu par l'équipe de modération. Si vous pensez qu'il s'agit d'une erreur, contactez-nous."
        action={<ButtonLink href="/contact?objet=compte">Contacter l&apos;équipe</ButtonLink>}
      />
    </div>
  );
}
