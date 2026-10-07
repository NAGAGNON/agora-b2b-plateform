import Link from "next/link";
import { LegalPage, Todo } from "@/components/legal-page";
import { Notice } from "@/components/ui/notice";
import { LEGAL, legalIncomplete, legalValue } from "@/lib/legal";
import { PLANS, formatEuros, priceTTC } from "@/lib/billing/plans";
import { stripeMode } from "@/lib/billing/stripe";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Conditions d'abonnement",
  description: "Prix, paiement, renouvellement, changement de formule, résiliation et retour à l'offre Gratuite des abonnements LinkProB2B Pro et Business.",
  path: "/conditions-abonnement",
});

export default function SubscriptionTermsPage() {
  const paid = PLANS.filter((p) => p.priceHT > 0);
  const testMode = stripeMode() !== "live";
  return (
    <LegalPage
      title="Conditions d'abonnement"
      current="/conditions-abonnement"
      intro={
        <>
          <p>
            Ces conditions complètent les <Link href="/cgu">conditions générales d&apos;utilisation</Link> pour les offres payantes {LEGAL.brand} Pro et
            Business. Elles sont acceptées, par une case à cocher, au moment de la souscription.
          </p>
          {(testMode || legalIncomplete()) && (
            <Notice tone="info" className="mt-4" title="Paiement en mode test">
              Les abonnements sont actuellement proposés dans l&apos;environnement de test de Stripe : aucun paiement réel n&apos;est encaissé. La
              commercialisation ouvrira une fois les informations légales de l&apos;éditeur complétées.
            </Notice>
          )}
        </>
      }
      sections={[
        {
          id: "offres-prix",
          title: "Offres et prix",
          content: (
            <>
              <ul>
                <li>
                  <strong>Gratuit</strong> : 0 €, sans carte bancaire, sans limite de durée, avec les limites décrites sur la page{" "}
                  <Link href="/tarifs">Tarifs</Link>.
                </li>
                {paid.map((p) => (
                  <li key={p.code}>
                    <strong>{p.name}</strong> : {formatEuros(p.priceHT)} HT par mois, soit {formatEuros(priceTTC(p.priceHT))} TTC avec la TVA au taux de
                    20 %.
                  </li>
                ))}
              </ul>
              <p>
                Le contenu de chaque offre est détaillé sur la page <Link href="/tarifs">Tarifs</Link>. Les prix applicables sont ceux affichés au moment de
                la souscription. Toute évolution de prix est annoncée au moins 30 jours à l&apos;avance et ne s&apos;applique qu&apos;à la période suivante ;
                vous pouvez résilier avant son entrée en vigueur.
              </p>
            </>
          ),
        },
        {
          id: "souscription",
          title: "Souscription",
          content: (
            <p>
              L&apos;abonnement est souscrit par un administrateur de l&apos;entreprise, pour le compte de celle-ci, depuis « Mon abonnement ». Il est réservé
              aux professionnels : le droit de rétractation prévu pour les consommateurs ne s&apos;applique pas. L&apos;offre est activée dès la confirmation
              du paiement par Stripe.
            </p>
          ),
        },
        {
          id: "paiement",
          title: "Paiement et factures",
          content: (
            <>
              <p>
                Le paiement s&apos;effectue par carte bancaire sur la page sécurisée de notre prestataire Stripe (Stripe Checkout). Vos données de carte sont
                saisies chez Stripe et ne sont jamais transmises ni conservées par {LEGAL.brand}. Les notifications de paiement reçues de Stripe sont
                authentifiées par signature avant toute mise à jour de votre offre.
              </p>
              <p>Une facture est émise à chaque échéance et téléchargeable dans « Mon abonnement » et dans le portail de gestion Stripe.</p>
            </>
          ),
        },
        {
          id: "renouvellement",
          title: "Durée et renouvellement",
          content: (
            <p>
              L&apos;abonnement est mensuel, sans engagement de durée. Il se renouvelle automatiquement chaque mois à date anniversaire, le montant étant
              prélevé sur le moyen de paiement enregistré, jusqu&apos;à résiliation.
            </p>
          ),
        },
        {
          id: "echec-paiement",
          title: "Échec de paiement",
          content: (
            <p>
              En cas d&apos;échec d&apos;un prélèvement, vous êtes prévenu par e-mail et dans l&apos;application (« Votre paiement n&apos;a pas pu être
              traité »). Stripe retente automatiquement le paiement ; votre accès est conservé pendant ces relances. Mettez à jour votre moyen de paiement
              depuis « Mon abonnement ». Si toutes les relances échouent, l&apos;abonnement prend fin et l&apos;entreprise repasse à l&apos;offre Gratuite.
            </p>
          ),
        },
        {
          id: "changement",
          title: "Changement de formule",
          content: (
            <p>
              Vous pouvez passer de Pro à Business, ou de Business à Pro, à tout moment depuis le portail de gestion Stripe accessible dans « Mon
              abonnement ». La différence de prix est calculée au prorata par Stripe et apparaît sur la facture suivante.
            </p>
          ),
        },
        {
          id: "resiliation",
          title: "Résiliation",
          content: (
            <p>
              La résiliation se fait en quelques clics depuis « Mon abonnement » (portail Stripe). Elle prend effet à la fin de la période mensuelle déjà
              payée : vous conservez l&apos;offre jusqu&apos;à cette date, sans remboursement de la période en cours. {LEGAL.brand} peut résilier un
              abonnement en cas de manquement grave aux CGU, après information motivée.
            </p>
          ),
        },
        {
          id: "retour-gratuit",
          title: "Retour à l'offre Gratuite",
          content: (
            <p>
              À la fin d&apos;un abonnement, l&apos;entreprise repasse automatiquement à l&apos;offre Gratuite. <strong>Aucune donnée n&apos;est supprimée</strong>{" "}
              : besoins, favoris, alertes, pipeline et messages restent accessibles. Seuls les nouveaux ajouts au-delà des limites de l&apos;offre Gratuite
              sont bloqués, jusqu&apos;à un éventuel nouvel abonnement.
            </p>
          ),
        },
        {
          id: "portail",
          title: "Portail de gestion Stripe",
          content: (
            <p>
              Le portail client Stripe, ouvert depuis « Mon abonnement », permet de mettre à jour le moyen de paiement, de télécharger les factures, de
              changer de formule et de résilier. Il est opéré par Stripe selon ses propres conditions.
            </p>
          ),
        },
        {
          id: "resultats",
          title: "Absence de garantie de résultat",
          content: (
            <p>
              Les offres payantes donnent accès à des fonctionnalités et à des volumes d&apos;utilisation supplémentaires. Elles ne garantissent ni
              l&apos;obtention de contrats ou de marchés, ni un nombre minimal d&apos;opportunités, ni un chiffre d&apos;affaires.
            </p>
          ),
        },
        {
          id: "vendeur",
          title: "Vendeur et contact",
          content: (
            <p>
              Le vendeur est {LEGAL.companyName ?? <Todo>{legalValue(null, "dénomination de l'éditeur")}</Todo>}, SIRET{" "}
              {LEGAL.siret ?? <Todo>{legalValue(null, "SIRET")}</Todo>}, TVA {LEGAL.vatNumber ?? <Todo>{legalValue(null, "numéro de TVA")}</Todo>}. Pour
              toute question : <Link href="/contact">page Contact</Link>. Les litiges sont régis par l&apos;article « Droit applicable » des{" "}
              <Link href="/cgu#droit-applicable">CGU</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}
