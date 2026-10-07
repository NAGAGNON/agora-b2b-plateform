import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { ButtonLink } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Pour les fournisseurs et prestataires",
  description: "Repérez les besoins des entreprises de votre secteur et de votre zone, répondez et suivez vos opportunités.",
  path: "/fournisseurs",
});

export default function SuppliersPage() {
  return (
    <ContentPage title="Pour les fournisseurs" intro="Repérez les besoins des entreprises de votre secteur, répondez au bon moment et suivez vos opportunités.">
      <h2>Ce que vous pouvez faire</h2>
      <ul>
        <li>Présenter votre entreprise : secteurs, compétences, zone d&apos;intervention, certifications ;</li>
        <li>Rechercher des opportunités par mots-clés, secteur, ville et rayon, type et date limite ;</li>
        <li>Consulter chaque jour les nouveaux appels d&apos;offres et besoins d&apos;entreprises, partout en France ;</li>
        <li>Recevoir des recommandations expliquées (secteur, région, département, compétences communes) ;</li>
        <li>Créer des alertes et enregistrer vos recherches et favoris ;</li>
        <li>Manifester votre intérêt, répondre aux consultations, échanger avec le demandeur ;</li>
        <li>Suivre chaque opportunité dans un pipeline privé, jusqu&apos;à « gagnée » ou « perdue » (offres Pro et Business).</li>
      </ul>
      <h2>Ce que nous ne faisons pas</h2>
      <ul>
        <li>Pas de « leads garantis » ni de promesse de résultat ;</li>
        <li>Pas de revente de vos données ;</li>
        <li>Pas d&apos;opportunité externe présentée comme un besoin déposé par un membre.</li>
      </ul>
      <h2>Tarif</h2>
      <p>
        Consultation et recherche gratuites, sans carte bancaire. L&apos;offre Gratuite inclut votre profil, 5 demandes de contact par mois, 10 favoris et
        1 alerte ; les offres Pro et Business ajoutent les recommandations complètes, les alertes illimitées et le pipeline. Voir les{" "}
        <Link href="/tarifs">tarifs</Link>.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 not-prose">
        <ButtonLink href="/inscription">Créer mon compte fournisseur</ButtonLink>
        <ButtonLink href="/opportunites" variant="outline">
          Voir les opportunités
        </ButtonLink>
      </div>
    </ContentPage>
  );
}
