import { ContentPage } from "@/components/content-page";
import { ButtonLink } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Tarifs", description: "LinkProB2B est actuellement gratuit, sans carte bancaire ni engagement.", path: "/tarifs" });

export default function PricingPage() {
  return (
    <ContentPage title="Tarifs" intro="Accès gratuit, sans carte bancaire.">
      <p>
        Toutes les fonctionnalités (publication, recherche, alertes, réponses, messagerie, pipeline) sont accessibles gratuitement,
        sans carte bancaire et sans engagement.
      </p>
      <h2>Évolution des offres</h2>
      <p>
        Des offres complémentaires pourront être proposées (par exemple : alertes et recherche avancées, comptes multi-utilisateurs étendus, outils
        commerciaux). Elles ne sont pas commercialisées aujourd&apos;hui. Leurs prix, conditions, renouvellement et résiliation seront affichés clairement
        avant toute souscription, et aucune fonctionnalité aujourd&apos;hui gratuite ne sera facturée sans votre accord explicite.
      </p>
      <ButtonLink href="/inscription">Créer un compte gratuit</ButtonLink>
    </ContentPage>
  );
}
