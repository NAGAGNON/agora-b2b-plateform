import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { pageMetadata } from "@/lib/seo";
import { PIPELINE_STAGES } from "@/lib/constants";

export const metadata = pageMetadata({
  title: "Comment ça marche",
  description: "Publier un besoin, trouver des opportunités, répondre, échanger et suivre son pipeline sur LinkProB2B.",
  path: "/comment-ca-marche",
});

export default function HowItWorksPage() {
  return (
    <ContentPage title="Comment ça marche" intro="LinkProB2B connecte les entreprises qui ont un besoin avec les entreprises capables d'y répondre.">
      <h2>1. Créez votre compte et le profil de votre entreprise</h2>
      <p>
        L&apos;inscription est gratuite. Le profil de l&apos;entreprise (secteurs, compétences, zone d&apos;intervention) apparaît dans
        l&apos;annuaire si vous le souhaitez et sert aux recommandations d&apos;opportunités. Plusieurs collègues peuvent rejoindre la même entreprise.
      </p>
      <h2>2. Côté demandeur : publiez un besoin</h2>
      <p>Quatre formats sont disponibles :</p>
      <ul>
        <li><strong>Besoin</strong> — vous recherchez un prestataire ou un fournisseur ;</li>
        <li><strong>Demande de devis</strong> — vous souhaitez plusieurs propositions chiffrées ;</li>
        <li><strong>Consultation privée</strong> — consultation structurée, avec critères et date limite ;</li>
        <li><strong>Appel d&apos;offres privé</strong> — cahier des charges, documents, critères, présélection et sélection.</li>
      </ul>
      <p>
        Chaque publication est relue par l&apos;équipe de modération avant diffusion (brouillon → en attente de validation → publiée → clôturée ou expirée →
        archivée). Vous recevez ensuite les manifestations d&apos;intérêt et les réponses, que vous pouvez présélectionner, comparer, accepter ou décliner,
        avant de clôturer la consultation.
      </p>
      <h2>3. Côté fournisseur : trouvez et répondez</h2>
      <p>
        Recherchez par mots-clés, secteur, localisation et rayon, type, statut ou date limite. Enregistrez vos recherches, créez des alertes (immédiates,
        quotidiennes ou hebdomadaires) et mettez des opportunités en favoris. Sur un besoin publié sur LinkProB2B, cliquez sur « Je suis intéressé » puis
        « Répondre à la consultation » pour envoyer votre proposition (message, prix, délai, validité, pièces jointes).
      </p>
      <h2>4. Opportunités externes</h2>
      <p>
        Certaines opportunités proviennent de sources extérieures autorisées. Elles sont toujours signalées comme « Opportunité externe », avec la source et la
        date de dernière vérification. La candidature se fait sur le site source : LinkProB2B ne transmet pas de candidature à leur place.
      </p>
      <h2>5. Échangez et suivez votre pipeline</h2>
      <p>
        La messagerie s&apos;ouvre entre un demandeur et un fournisseur dès qu&apos;un intérêt ou une réponse existe. Côté fournisseur, un pipeline privé suit
        chaque opportunité : {PIPELINE_STAGES.map((s) => s.label.toLowerCase()).join(" → ")}.
      </p>
      <h2>Confiance</h2>
      <ul>
        <li>Provenance toujours affichée, données de démonstration clairement identifiées ;</li>
        <li>Badge « Entreprise vérifiée » uniquement après contrôle par notre équipe ;</li>
        <li>Signalement possible sur chaque fiche, chaque profil et chaque message.</li>
      </ul>
      <p>
        <Link href="/inscription">Créer un compte gratuit</Link> · <Link href="/faq">Questions fréquentes</Link>
      </p>
    </ContentPage>
  );
}
