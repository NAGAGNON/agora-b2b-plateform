import { ContentPage } from "@/components/content-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Mentions légales", description: "Mentions légales de LinkProB2B.", path: "/mentions-legales" });

export default function LegalPage() {
  return (
    <ContentPage title="Mentions légales" legalDraft updated="octobre 2026">
      <h2>Éditeur du site</h2>
      <p>
        [Raison sociale] — [forme juridique] au capital de [montant] €<br />
        Siège social : [adresse]<br />
        RCS / SIREN : [numéro] — TVA intracommunautaire : [numéro]<br />
        Directeur de la publication : [nom]<br />
        Contact : via la page Contact
      </p>
      <h2>Hébergement</h2>
      <p>
        Application : [hébergeur de l&apos;application, ex. Vercel Inc., adresse]<br />
        Base de données et fichiers : [hébergeur, ex. Supabase — région d&apos;hébergement à préciser]
      </p>
      <h2>Propriété intellectuelle</h2>
      <p>
        La marque, le logo et les contenus éditoriaux de LinkProB2B sont protégés. Les contenus publiés par les membres restent sous leur responsabilité. Les
        opportunités externes sont référencées avec mention de leur source, selon les conditions de réutilisation de chaque source.
      </p>
      <h2>Signalement de contenu</h2>
      <p>Tout contenu illicite ou erroné peut être signalé via le bouton « Signaler » ou la page Contact.</p>
    </ContentPage>
  );
}
