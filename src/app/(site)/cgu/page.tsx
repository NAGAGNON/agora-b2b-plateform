import { ContentPage } from "@/components/content-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Conditions générales d'utilisation", description: "Conditions d'utilisation et règles de publication de LinkProB2B.", path: "/cgu" });

export default function TermsPage() {
  return (
    <ContentPage title="Conditions générales d'utilisation" legalDraft updated="octobre 2026">
      <h2>1. Objet</h2>
      <p>Les présentes conditions encadrent l&apos;utilisation de la plateforme LinkProB2B, service de mise en relation entre entreprises.</p>
      <h2>2. Accès et compte</h2>
      <p>
        Le service est réservé aux professionnels. L&apos;utilisateur garantit l&apos;exactitude des informations fournies et la confidentialité de ses
        identifiants. Le service est actuellement gratuit.
      </p>
      <h2>3. Règles de publication</h2>
      <ul>
        <li>Publier uniquement des besoins réels, au nom d&apos;une entreprise que l&apos;on est autorisé à représenter ;</li>
        <li>Ne pas publier de contenu illicite, trompeur, discriminatoire ou portant atteinte aux droits de tiers ;</li>
        <li>Ne pas publier de données personnelles inutiles (dans les descriptions ou documents) ;</li>
        <li>Toute publication est soumise à modération et peut être refusée, modifiée à la demande, suspendue ou archivée.</li>
      </ul>
      <h2>4. Opportunités externes</h2>
      <p>
        Les opportunités externes sont référencées à titre informatif avec leur source. LinkProB2B n&apos;en est pas l&apos;auteur ; les conditions de
        candidature sont celles du site source, qui fait foi.
      </p>
      <h2>5. Messagerie</h2>
      <p>La messagerie est réservée aux échanges professionnels liés à une opportunité. Tout abus peut être signalé et entraîner une suspension.</p>
      <h2>6. Responsabilité</h2>
      <p>
        LinkProB2B est un intermédiaire technique de mise en relation : il n&apos;est pas partie aux contrats conclus entre entreprises et ne garantit pas
        leur issue. [Clauses de responsabilité à compléter avec un professionnel.]
      </p>
      <h2>7. Suspension et résiliation</h2>
      <p>Le compte peut être supprimé à tout moment par l&apos;utilisateur. LinkProB2B peut suspendre un compte en cas de manquement à ces conditions.</p>
      <h2>8. Droit applicable</h2>
      <p>[Droit applicable et juridiction compétente à compléter.]</p>
    </ContentPage>
  );
}
