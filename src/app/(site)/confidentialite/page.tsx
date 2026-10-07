import Link from "next/link";
import { LegalPage, Todo } from "@/components/legal-page";
import { LEGAL, PROCESSORS, legalValue } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Politique de confidentialité",
  description: "Données personnelles traitées par LinkProB2B : finalités, bases légales, durées de conservation, destinataires et droits.",
  path: "/confidentialite",
});

const T = ({ label }: { label: string }) => <Todo>{legalValue(null, label)}</Todo>;

type Row = { purpose: string; data: string; basis: string; retention: React.ReactNode; recipients: string };

const TREATMENTS: Row[] = [
  {
    purpose: "Création et gestion du compte, authentification",
    data: "Nom et prénom, adresse e-mail, mot de passe (stocké sous forme hachée par Supabase), fonction et téléphone (facultatifs), date d'acceptation des CGU, dernière connexion",
    basis: "Exécution du contrat (CGU)",
    retention: "Durée du compte ; suppression à la suppression du compte",
    recipients: "Équipe LinkProB2B habilitée ; Supabase (hébergement)",
  },
  {
    purpose: "Fiche entreprise, annuaire, publications, réponses, messagerie, favoris, alertes, pipeline",
    data: "Données professionnelles saisies (entreprise, besoins, réponses, messages, documents déposés), préférences",
    basis: "Exécution du contrat (CGU)",
    retention: "Durée du compte ou de l'entreprise ; les contenus publics restent visibles tant qu'ils sont publiés",
    recipients: "Autres utilisateurs selon la visibilité (fiche et besoins publics ; réponses et messages visibles par la seule entreprise concernée)",
  },
  {
    purpose: "E-mails transactionnels : confirmation d'inscription, mot de passe, notifications, alertes",
    data: "Adresse e-mail, nom, contenu de la notification",
    basis: "Exécution du contrat ; notifications et alertes désactivables à tout moment",
    retention: <T label="durée de conservation du journal d'envoi des e-mails" />,
    recipients: "Resend (envoi)",
  },
  {
    purpose: "Actualités de LinkProB2B",
    data: "Adresse e-mail, nom",
    basis: "Consentement (case facultative, non pré-cochée), retirable dans Paramètres",
    retention: "Jusqu'au retrait du consentement ou à la suppression du compte",
    recipients: "Resend (envoi)",
  },
  {
    purpose: "Abonnements payants : paiement, facturation, gestion des échecs de paiement",
    data: "Entreprise, e-mail de l'administrateur, adresse de facturation, numéro de TVA le cas échéant, historique d'abonnement et de factures. Les données de carte bancaire sont saisies et conservées par Stripe uniquement : elles ne transitent jamais par nos serveurs.",
    basis: "Exécution du contrat ; obligations légales comptables et fiscales",
    retention: "Pièces comptables : 10 ans (article L123-22 du Code de commerce) ; autres données : durée de l'abonnement",
    recipients: "Stripe (paiement)",
  },
  {
    purpose: "Sécurité, prévention des abus, modération",
    data: "Journal des actions importantes (connexion, publication, modération, changement d'offre), signalements, empreinte non réversible de l'adresse IP pour la limitation de débit",
    basis: "Intérêt légitime (sécurité du service et des utilisateurs)",
    retention: <>Empreinte IP : 48 heures maximum ; journal d&apos;audit : <T label="durée du journal d'audit" /></>,
    recipients: "Équipe LinkProB2B habilitée (administration, modération)",
  },
  {
    purpose: "Formulaire de contact",
    data: "Nom, e-mail, entreprise (facultatif), objet, message",
    basis: "Intérêt légitime (répondre aux demandes)",
    retention: <T label="durée de conservation des messages de contact" />,
    recipients: "Équipe LinkProB2B habilitée",
  },
  {
    purpose: "Statistiques d'usage et mesure d'audience",
    data: "Mesure interne sans cookie : page consultée, site d'origine, type d'appareil, durée de lecture, identifiant aléatoire de visite (sans IP ni compte). Événements d'usage (ex. recherche effectuée) liés au compte. Vercel Web Analytics : statistiques agrégées sans cookie.",
    basis: "Intérêt légitime (amélioration du service)",
    retention: <>Mesure de fréquentation : 13 mois ; événements d&apos;usage : <T label="durée des événements d'usage" /></>,
    recipients: "Équipe LinkProB2B ; Vercel",
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      current="/confidentialite"
      intro={
        <p>
          Cette politique décrit les données personnelles traitées par {LEGAL.brand}, établie à partir du fonctionnement réel de la plateforme. Aucune
          donnée n&apos;est vendue ni utilisée à des fins publicitaires.
        </p>
      }
      sections={[
        {
          id: "responsable",
          title: "Responsable du traitement",
          content: (
            <p>
              {LEGAL.companyName ?? <T label="dénomination de l'éditeur" />}, {LEGAL.address ?? <T label="adresse" />} — contact :{" "}
              {LEGAL.contactEmail ?? <T label="e-mail de contact pour les données personnelles" />} ou <Link href="/contact">page Contact</Link>.{" "}
              Aucun délégué à la protection des données (DPO) n&apos;est désigné à ce jour.
            </p>
          ),
        },
        {
          id: "traitements",
          title: "Données traitées, finalités, bases légales et durées",
          content: (
            <div className="space-y-4">
              {TREATMENTS.map((t) => (
                <div key={t.purpose} className="rounded-xl border border-slate-200 p-4">
                  <h3 className="!mt-0">{t.purpose}</h3>
                  <dl className="grid gap-1 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
                    <dt className="font-semibold text-navy">Données</dt>
                    <dd>{t.data}</dd>
                    <dt className="font-semibold text-navy">Base légale</dt>
                    <dd>{t.basis}</dd>
                    <dt className="font-semibold text-navy">Conservation</dt>
                    <dd>{t.retention}</dd>
                    <dt className="font-semibold text-navy">Destinataires</dt>
                    <dd>{t.recipients}</dd>
                  </dl>
                </div>
              ))}
            </div>
          ),
        },
        {
          id: "sous-traitants",
          title: "Prestataires (sous-traitants)",
          content: (
            <>
              <p>Seuls les prestataires suivants, nécessaires au service, traitent des données pour notre compte :</p>
              <ul>
                {PROCESSORS.map((p) => (
                  <li key={p.name}>
                    <strong>{p.name}</strong> — {p.role}. Données : {p.data}. Localisation : {p.location}
                    {p.name.startsWith("Supabase") && <> ({LEGAL.supabaseRegion ?? <T label="région Supabase" />})</>}.{" "}
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      Politique du prestataire
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ),
        },
        {
          id: "transferts",
          title: "Transferts hors de l'Union européenne",
          content: (
            <p>
              Certains prestataires sont établis aux États-Unis. Les transferts sont encadrés par les clauses contractuelles types de la Commission
              européenne et, le cas échéant, par l&apos;adhésion du prestataire au cadre de protection des données UE–États-Unis.{" "}
              <Todo>[À COMPLÉTER : vérifier et conserver les accords de traitement (DPA) de chaque prestataire]</Todo>
            </p>
          ),
        },
        {
          id: "sources-publiques",
          title: "Données issues de sources publiques",
          content: (
            <p>
              Les opportunités externes reprennent des avis publiés sur BOAMP et TED, qui peuvent contenir le nom et les coordonnées professionnelles d&apos;un
              acheteur public. Ces informations sont affichées telles que publiées par la source officielle, identifiée sur chaque annonce.
            </p>
          ),
        },
        {
          id: "securite",
          title: "Sécurité",
          content: (
            <p>
              Connexions chiffrées (HTTPS), mots de passe hachés, contrôle d&apos;accès au niveau de chaque ligne de la base de données, double
              authentification pour l&apos;équipe d&apos;administration, documents accessibles par liens temporaires, journal des actions sensibles. Les clés
              de paiement ne sont jamais exposées au navigateur et les notifications de paiement sont authentifiées par signature.
            </p>
          ),
        },
        {
          id: "droits",
          title: "Vos droits",
          content: (
            <>
              <p>
                Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité. Directement
                depuis votre espace : modification du profil, export de vos données et suppression du compte (
                <Link href="/dashboard/parametres">Paramètres</Link>), désactivation des e-mails et des actualités.
              </p>
              <p>
                Pour toute autre demande : {LEGAL.contactEmail ?? <T label="e-mail de contact" />} ou <Link href="/contact">page Contact</Link>. Une
                réponse est apportée dans un délai d&apos;un mois. Vous pouvez introduire une réclamation auprès de la CNIL (
                <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">
                  cnil.fr
                </a>
                ).
              </p>
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies",
          content: (
            <p>
              Voir la <Link href="/cookies">politique cookies</Link> : seuls des cookies strictement nécessaires sont utilisés.
            </p>
          ),
        },
      ]}
    />
  );
}
