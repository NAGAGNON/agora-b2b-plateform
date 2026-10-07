import Link from "next/link";
import { LegalPage, Todo } from "@/components/legal-page";
import { LEGAL, legalValue } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Conditions générales d'utilisation",
  description: "Règles d'utilisation de LinkProB2B : compte, publications, messagerie, opportunités externes, responsabilités.",
  path: "/cgu",
});

const editor = LEGAL.companyName ?? legalValue(null, "dénomination de l'éditeur");

export default function TermsPage() {
  return (
    <LegalPage
      title="Conditions générales d'utilisation"
      current="/cgu"
      intro={
        <p>
          Les présentes conditions générales d&apos;utilisation (« CGU ») encadrent l&apos;accès et l&apos;utilisation de la plateforme {LEGAL.brand},
          éditée par {LEGAL.companyName ? editor : <Todo>{editor}</Todo>} (voir les <Link href="/mentions-legales">mentions légales</Link>). Elles sont
          acceptées lors de la création du compte.
        </p>
      }
      sections={[
        {
          id: "objet",
          title: "Objet du service",
          content: (
            <>
              <p>
                {LEGAL.brand} est une plateforme de mise en relation entre professionnels, centrée sur la Bretagne. Elle permet notamment de :
              </p>
              <ul>
                <li>créer un compte et une fiche entreprise, consultable dans l&apos;annuaire ;</li>
                <li>publier des besoins (demandes de devis, consultations, recherches de partenaires), après modération ;</li>
                <li>consulter des opportunités, dont des marchés publics repris de sources officielles (BOAMP, TED) ;</li>
                <li>manifester son intérêt, déposer une réponse et échanger par messagerie avec l&apos;entreprise concernée ;</li>
                <li>enregistrer des favoris, créer des alertes e-mail, recevoir des recommandations et suivre ses opportunités dans un pipeline ;</li>
                <li>inviter des collaborateurs à rejoindre son entreprise ;</li>
                <li>consulter des analyses de marché rédigées à partir des données publiées sur la plateforme.</li>
              </ul>
              <p>
                Certaines fonctionnalités ou volumes d&apos;utilisation dépendent de l&apos;offre choisie (Gratuit, Pro, Business), décrite sur la page{" "}
                <Link href="/tarifs">Tarifs</Link>. Les offres payantes sont régies en complément par les{" "}
                <Link href="/conditions-abonnement">conditions d&apos;abonnement</Link>.
              </p>
            </>
          ),
        },
        {
          id: "acces-compte",
          title: "Accès au service et compte",
          content: (
            <>
              <p>
                Le service est réservé aux professionnels (entreprises, indépendants, associations, organismes publics) agissant pour les besoins de leur
                activité. L&apos;utilisateur garantit l&apos;exactitude des informations fournies, les tient à jour et déclare être autorisé à représenter
                l&apos;entreprise qu&apos;il crée ou rejoint.
              </p>
              <p>
                Les identifiants sont personnels et confidentiels. L&apos;utilisateur est responsable de l&apos;usage de son compte et doit signaler sans
                délai toute utilisation non autorisée. Le compte peut être supprimé à tout moment depuis{" "}
                <Link href="/dashboard/parametres">Paramètres</Link>.
              </p>
            </>
          ),
        },
        {
          id: "contenus",
          title: "Contenus publiés par les utilisateurs",
          content: (
            <>
              <p>L&apos;utilisateur est seul responsable des contenus qu&apos;il publie (fiche entreprise, besoins, réponses, messages, documents). Il s&apos;engage à :</p>
              <ul>
                <li>publier uniquement des besoins réels et des informations exactes ;</li>
                <li>ne publier aucun contenu illicite, trompeur, diffamatoire, discriminatoire ou portant atteinte aux droits de tiers (droits d&apos;auteur, marques, secret des affaires) ;</li>
                <li>ne pas publier de données personnelles inutiles dans les descriptions ou documents ;</li>
                <li>ne pas utiliser la plateforme pour de la prospection non sollicitée de masse, du démarchage abusif ou l&apos;envoi de contenus malveillants ;</li>
                <li>ne pas collecter de manière automatisée les données de la plateforme (aspiration, robots).</li>
              </ul>
              <p>
                L&apos;utilisateur accorde à l&apos;éditeur, pour la durée de publication, le droit non exclusif d&apos;héberger, reproduire et afficher ses
                contenus sur la plateforme, dans la seule mesure nécessaire au fonctionnement du service.
              </p>
            </>
          ),
        },
        {
          id: "moderation",
          title: "Modération et signalement",
          content: (
            <p>
              Les besoins publiés sont soumis à une modération avant leur mise en ligne et peuvent être refusés, faire l&apos;objet d&apos;une demande de
              modification, être suspendus ou archivés. Tout utilisateur peut signaler un contenu ou un comportement via le bouton « Signaler » ou la{" "}
              <Link href="/contact?objet=signalement">page Contact</Link>. Les décisions de modération sont motivées et journalisées.
            </p>
          ),
        },
        {
          id: "sources-externes",
          title: "Opportunités issues de sources externes",
          content: (
            <p>
              Les opportunités externes (notamment les marchés publics) sont reprises de sources publiques officielles, toujours identifiées sur
              l&apos;annonce (BOAMP, TED). {LEGAL.brand} n&apos;est ni l&apos;acheteur ni l&apos;éditeur de ces avis : seul l&apos;avis publié sur le site
              source fait foi, notamment pour les dates limites et les conditions de candidature. Malgré le soin apporté à leur reprise, des écarts ou retards
              de mise à jour sont possibles.
            </p>
          ),
        },
        {
          id: "messagerie",
          title: "Messagerie",
          content: (
            <p>
              La messagerie est réservée aux échanges professionnels liés à une opportunité. Les messages ne sont visibles que par les entreprises
              concernées. Tout abus peut être signalé et entraîner une suspension.
            </p>
          ),
        },
        {
          id: "analyses",
          title: "Analyses et recommandations",
          content: (
            <p>
              Les recommandations sont calculées selon un barème transparent (secteurs, zone, compétences) et les analyses de marché sont établies à partir des
              seules données publiées sur la plateforme. Elles sont fournies à titre indicatif
              et ne constituent ni un conseil ni une garantie.
            </p>
          ),
        },
        {
          id: "propriete",
          title: "Propriété intellectuelle",
          content: (
            <p>
              La plateforme, sa marque, son logo, ses contenus éditoriaux et ses bases de données sont protégés. Aucune licence n&apos;est accordée en dehors
              de l&apos;utilisation normale du service.
            </p>
          ),
        },
        {
          id: "services-tiers",
          title: "Services tiers",
          content: (
            <p>
              Le service s&apos;appuie sur des prestataires techniques : Vercel (hébergement), Supabase (base de données, authentification, fichiers), Resend
              (e-mails) et Stripe (paiement des abonnements). Le paiement est effectué sur les pages de Stripe,
              selon ses propres conditions. Le détail figure dans la <Link href="/confidentialite">politique de confidentialité</Link>.
            </p>
          ),
        },
        {
          id: "responsabilite",
          title: "Responsabilité",
          content: (
            <>
              <p>
                {LEGAL.brand} est un intermédiaire technique de mise en relation. L&apos;éditeur n&apos;est pas partie aux échanges, devis, contrats ou
                marchés conclus entre utilisateurs, et ne garantit ni l&apos;obtention de contrats, ni un volume d&apos;opportunités, ni un résultat
                commercial. Il ne vérifie pas la solvabilité ou les qualifications des entreprises, sauf mention « vérifiée » explicitement indiquée.
              </p>
              <p>
                L&apos;éditeur met en œuvre des moyens raisonnables pour assurer la disponibilité et la sécurité du service, sans garantie
                d&apos;absence d&apos;interruption (maintenance, incident d&apos;un prestataire). Sa responsabilité ne saurait être engagée pour les dommages
                indirects. <Todo>[À COMPLÉTER : plafond de responsabilité éventuel, à valider par un professionnel du droit]</Todo>
              </p>
            </>
          ),
        },
        {
          id: "suspension",
          title: "Suspension et résiliation",
          content: (
            <p>
              En cas de manquement aux présentes CGU (contenu illicite, fraude, usurpation, abus de la messagerie), l&apos;éditeur peut suspendre un contenu,
              une entreprise ou un compte, si possible après avertissement et toujours avec indication du motif. L&apos;utilisateur peut supprimer son compte à
              tout moment ; un abonnement en cours se résilie depuis « Mon abonnement ».
            </p>
          ),
        },
        {
          id: "donnees",
          title: "Données personnelles",
          content: (
            <p>
              Les traitements de données personnelles sont décrits dans la <Link href="/confidentialite">politique de confidentialité</Link> et la{" "}
              <Link href="/cookies">politique cookies</Link>.
            </p>
          ),
        },
        {
          id: "modification",
          title: "Modification des CGU",
          content: (
            <p>
              Les CGU peuvent évoluer. Les utilisateurs sont informés de toute modification substantielle avant son entrée en vigueur ; la poursuite de
              l&apos;utilisation vaut acceptation.
            </p>
          ),
        },
        {
          id: "droit-applicable",
          title: "Droit applicable et litiges",
          content: (
            <p>
              Les présentes CGU sont soumises au droit français. En cas de litige, les parties recherchent d&apos;abord une solution amiable. À défaut,
              compétence est attribuée aux{" "}
              {LEGAL.jurisdiction ?? <Todo>{legalValue(null, "juridiction compétente, à valider par un professionnel du droit")}</Todo>}.
            </p>
          ),
        },
      ]}
    />
  );
}
