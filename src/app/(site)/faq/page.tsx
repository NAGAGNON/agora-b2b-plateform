import { ContentPage } from "@/components/content-page";
import { pageMetadata } from "@/lib/seo";
import { JsonLd, faqLd } from "@/components/json-ld";

export const metadata = pageMetadata({
  title: "Questions fréquentes",
  description: "Sources des opportunités, actualisation quotidienne, couverture France entière, offres Gratuit, Pro et Business : réponses aux questions fréquentes.",
  path: "/faq",
});

const FAQ: [string, string][] = [
  ["Qu'est-ce que LinkProB2B ?", "Une plateforme B2B française qui centralise les opportunités commerciales — appels d'offres publics, consultations et besoins publiés par des entreprises — et facilite la mise en relation entre entreprises : acheteurs, fournisseurs, prestataires et partenaires, partout en France."],
  ["D'où viennent les opportunités ?", "De deux origines, toujours indiquées : les avis officiels de marchés publics (BOAMP — Direction de l'information légale et administrative, et TED — Office des publications de l'Union européenne), et les besoins publiés directement par les entreprises inscrites. Chaque opportunité externe renvoie vers l'annonce officielle, qui fait foi."],
  ["Les opportunités sont-elles à jour ?", "Oui : la base est actualisée automatiquement chaque jour. Les nouvelles annonces sont ajoutées, celles modifiées à la source sont mises à jour, les doublons entre sources sont regroupés et les opportunités dont la date limite est dépassée sont retirées des résultats actifs (elles restent consultables via le filtre « Clôturées ou expirées »)."],
  ["Quelles régions sont couvertes ?", "Toute la France : métropole et outre-mer. Vous pouvez filtrer par région, département, ville, code postal ou rayon autour d'une ville."],
  ["LinkProB2B est-il payant ?", "La consultation et la recherche des opportunités sont gratuites, sans carte bancaire. L'offre Gratuite inclut aussi un profil d'entreprise, 1 besoin actif, 5 demandes de contact par mois, 10 favoris et 1 alerte. Les offres Pro (29 € HT/mois) et Business (59 € HT/mois) ajoutent les recommandations personnalisées, les alertes illimitées, le pipeline commercial, davantage de contacts et, pour Business, plusieurs utilisateurs. Voir la page Tarifs."],
  ["LinkProB2B garantit-il l'obtention de marchés ?", "Non. LinkProB2B vous aide à repérer des opportunités et des partenaires ; l'obtention d'un contrat dépend de vos échanges et de vos offres. Les conditions de candidature aux marchés publics sont celles de l'avis officiel."],
  ["Quelle différence entre un besoin publié et une opportunité externe ?", "Un « Besoin publié sur LinkProB2B » est déposé par une entreprise membre : vous y répondez sur la plateforme. Une « Opportunité externe » est référencée depuis une source officielle : la candidature se fait sur le site source, indiqué sur la fiche."],
  ["Comment recevoir les opportunités qui me concernent ?", "Créez votre compte puis complétez votre profil (secteurs, zone, compétences) : vous obtenez des recommandations et pouvez créer des alertes e-mail (immédiates, quotidiennes ou hebdomadaires) par secteur, région, département, mots-clés ou type."],
  ["Les publications sont-elles vérifiées ?", "Chaque besoin publié par une entreprise est relu par la modération avant diffusion. Le badge « Entreprise vérifiée » n'est attribué qu'après un contrôle par notre équipe. Les informations des profils restent déclarées par les entreprises."],
  ["Qui voit ma réponse à une consultation ?", "Uniquement votre entreprise et l'entreprise qui a publié la consultation. Les autres fournisseurs ne la voient pas."],
  ["Mon pipeline est-il visible par d'autres ?", "Non. Le pipeline (offres Pro et Business) est strictement privé à votre entreprise, y compris vis-à-vis de l'équipe LinkProB2B."],
  ["Puis-je contacter directement n'importe quelle entreprise ?", "La messagerie s'ouvre dans le cadre d'une opportunité : entre le demandeur et un fournisseur ayant manifesté son intérêt ou répondu. Cela limite les sollicitations non désirées."],
  ["Comment résilier un abonnement ?", "Depuis « Mon abonnement », en quelques clics (portail sécurisé Stripe). La résiliation prend effet à la fin de la période payée ; votre entreprise repasse alors à l'offre Gratuite sans perte de données."],
  ["Comment signaler un contenu ?", "Chaque fiche, profil et message dispose d'un bouton « Signaler ». Vous pouvez aussi utiliser la page Contact."],
  ["Comment supprimer mon compte ou exporter mes données ?", "Depuis votre espace, rubrique Paramètres : export au format JSON et suppression définitive du compte."],
];

export default function FaqPage() {
  return (
    <ContentPage title="Questions fréquentes" intro="Tout ce qu'il faut savoir sur les opportunités, leurs sources, leur actualisation et les offres LinkProB2B.">
      <JsonLd data={faqLd(FAQ.map(([question, answer]) => ({ question, answer })))} />
      <div className="space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group rounded-xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer font-semibold text-navy">{q}</summary>
            <p className="mt-2 mb-0">{a}</p>
          </details>
        ))}
      </div>
    </ContentPage>
  );
}
