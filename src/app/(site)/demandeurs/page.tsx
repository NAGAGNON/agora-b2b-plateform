import { ContentPage } from "@/components/content-page";
import { ButtonLink } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Pour les entreprises demandeuses",
  description: "Publiez un besoin, une demande de devis, une consultation ou un appel d'offres privé et comparez les réponses.",
  path: "/demandeurs",
});

export default function BuyersPage() {
  return (
    <ContentPage title="Pour les demandeurs" intro="Décrivez votre besoin une fois, recevez des réponses comparables, choisissez en confiance.">
      <h2>Publier</h2>
      <p>Un formulaire en six étapes vous guide : type de demande, informations, besoin technique, conditions, aperçu, publication.</p>
      <h2>Gérer vos consultations</h2>
      <ul>
        <li>Voir les fournisseurs intéressés et les réponses reçues ;</li>
        <li>Comparer prix, délais et validité dans un tableau ;</li>
        <li>Noter chaque réponse en interne (non visible du fournisseur) ;</li>
        <li>Présélectionner, demander des informations, accepter, décliner, sélectionner ;</li>
        <li>Échanger par messagerie, puis clôturer en indiquant le résultat si vous le souhaitez.</li>
      </ul>
      <h2>Confidentialité</h2>
      <p>
        Vous choisissez si votre publication est publique ou réservée aux membres connectés. Le budget peut rester interne. Les documents ne sont accessibles
        qu&apos;aux membres connectés.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/publier">Publier un besoin</ButtonLink>
        <ButtonLink href="/entreprises" variant="outline">
          Parcourir l&apos;annuaire
        </ButtonLink>
      </div>
    </ContentPage>
  );
}
