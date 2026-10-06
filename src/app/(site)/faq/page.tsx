import { ContentPage } from "@/components/content-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Questions fréquentes", description: "Réponses aux questions fréquentes sur LinkProB2B.", path: "/faq" });

const FAQ: [string, string][] = [
  ["LinkProB2B est-il payant ?", "Non. L'accès est gratuit pendant toute la durée du pilote. Les éventuelles offres payantes futures seront annoncées clairement, avec leurs conditions, avant toute souscription."],
  ["Quelle différence entre un besoin publié et une opportunité externe ?", "Un « Besoin publié sur LinkProB2B » est déposé par une entreprise membre : vous y répondez sur la plateforme. Une « Opportunité externe » est référencée depuis une source extérieure autorisée : la candidature se fait sur le site source, indiqué sur la fiche."],
  ["Les publications sont-elles vérifiées ?", "Chaque publication interne est relue par la modération avant diffusion. Le badge « Entreprise vérifiée » n'est attribué qu'après un contrôle par notre équipe. Les informations des profils restent déclarées par les entreprises."],
  ["Qui voit ma réponse à une consultation ?", "Uniquement votre entreprise et l'entreprise qui a publié la consultation. Les autres fournisseurs ne la voient pas."],
  ["Mon pipeline est-il visible par d'autres ?", "Non. Le pipeline est strictement privé à votre entreprise, y compris vis-à-vis de l'équipe LinkProB2B."],
  ["Puis-je contacter directement n'importe quelle entreprise ?", "La messagerie s'ouvre dans le cadre d'une opportunité : entre le demandeur et un fournisseur ayant manifesté son intérêt ou répondu. Cela limite les sollicitations non désirées."],
  ["Comment signaler un contenu ?", "Chaque fiche, profil et message dispose d'un bouton « Signaler ». Vous pouvez aussi utiliser la page Contact."],
  ["Comment supprimer mon compte ou exporter mes données ?", "Depuis votre espace, rubrique Paramètres : export au format JSON et suppression définitive du compte."],
  ["Que signifient les mentions « Démo » ?", "Pendant la phase de test, des données de démonstration fictives peuvent être affichées. Elles sont toujours marquées « Démo » et ne correspondent à aucune entreprise ni opportunité réelle."],
];

export default function FaqPage() {
  return (
    <ContentPage title="Questions fréquentes">
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
