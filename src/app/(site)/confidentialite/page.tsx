import { ContentPage } from "@/components/content-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Politique de confidentialité", description: "Traitement des données personnelles sur LinkProB2B.", path: "/confidentialite" });

export default function PrivacyPage() {
  return (
    <ContentPage title="Politique de confidentialité" legalDraft updated="octobre 2026">
      <h2>Responsable du traitement</h2>
      <p>[Raison sociale, adresse, contact du responsable / DPO le cas échéant].</p>
      <h2>Données traitées</h2>
      <ul>
        <li>Compte : nom, e-mail professionnel, fonction et téléphone (facultatifs), mot de passe (stocké sous forme chiffrée par le prestataire d&apos;authentification) ;</li>
        <li>Activité professionnelle : entreprises, publications, intérêts, réponses, messages, favoris, alertes ;</li>
        <li>Journal d&apos;audit des actions importantes (sécurité, modération) ;</li>
        <li>Mesure d&apos;audience interne : événements d&apos;usage (ex. recherche effectuée, fiche consultée) liés au compte le cas échéant, sans adresse IP, sans cookie de mesure ;</li>
        <li>Limitation de débit : empreinte non réversible de l&apos;adresse IP, conservée au plus 48 heures.</li>
      </ul>
      <h2>Finalités et bases légales</h2>
      <ul>
        <li>Fourniture du service de mise en relation — exécution du contrat (CGU) ;</li>
        <li>Sécurité, prévention des abus, modération — intérêt légitime ;</li>
        <li>Notifications et alertes par e-mail — exécution du contrat, désactivables à tout moment ;</li>
        <li>Informations sur le pilote — consentement (case facultative) ;</li>
        <li>Amélioration du service par statistiques d&apos;usage agrégées — intérêt légitime.</li>
      </ul>
      <h2>Destinataires</h2>
      <p>
        Les autres membres voient uniquement ce que vous publiez (profil d&apos;entreprise, publications) ; les réponses ne sont visibles que par
        l&apos;entreprise destinataire. Sous-traitants techniques : [hébergement, base de données, e-mail transactionnel — liste et localisation à compléter].
        Aucune donnée n&apos;est vendue.
      </p>
      <h2>Durées de conservation</h2>
      <p>[À définir et valider : par exemple durée du compte, puis suppression ; journaux techniques ; messages de contact.]</p>
      <h2>Vos droits</h2>
      <p>
        Accès, rectification, effacement, portabilité, opposition et limitation. Export et suppression du compte sont disponibles directement dans votre
        espace (Paramètres). Pour toute autre demande, utilisez la page Contact. Vous pouvez introduire une réclamation auprès de la CNIL.
      </p>
    </ContentPage>
  );
}
