import { ContentPage } from "@/components/content-page";
import { ButtonLink } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Tarifs", description: "LinkProB2B est gratuit pendant la phase pilote.", path: "/tarifs" });

export default function PricingPage() {
  return (
    <ContentPage title="Tarifs" intro="Gratuit pendant le pilote.">
      <p>
        Toutes les fonctionnalités (publication, recherche, alertes, réponses, messagerie, pipeline) sont accessibles gratuitement pendant la phase pilote,
        sans carte bancaire et sans engagement.
      </p>
      <h2>Et après le pilote ?</h2>
      <p>
        Des offres complémentaires pourront être proposées (par exemple : alertes et recherche avancées, comptes multi-utilisateurs étendus, outils
        commerciaux). Elles ne sont pas commercialisées aujourd&apos;hui. Leurs prix, conditions, renouvellement et résiliation seront affichés clairement
        avant toute souscription, et aucune fonctionnalité gratuite utilisée pendant le pilote ne sera facturée sans votre accord explicite.
      </p>
      <ButtonLink href="/inscription">Créer un compte gratuit</ButtonLink>
    </ContentPage>
  );
}
