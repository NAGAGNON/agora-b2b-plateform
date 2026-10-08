import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Politique cookies", description: "Cookies et traceurs utilisés par LinkProB2B : uniquement des cookies strictement nécessaires.", path: "/cookies" });

/** Inventaire établi à partir du code de l'application (aucun autre cookie n'est déposé). */
const ITEMS = [
  { name: "sb-…-auth-token", kind: "Cookie", category: "Strictement nécessaire", purpose: "Session de connexion sécurisée (Supabase)", duration: "Durée de la session de connexion" },
  { name: "lp_company", kind: "Cookie", category: "Strictement nécessaire", purpose: "Mémorise l'entreprise active quand vous en gérez plusieurs", duration: "Session du navigateur" },
  {
    name: "lp_prospection",
    kind: "Cookie",
    category: "Strictement nécessaire",
    purpose: "Uniquement après un clic dans une sélection d'opportunités reçue par e-mail : retrouver l'offre demandée et la page d'accès, puis l'ouvrir après inscription ou connexion",
    duration: "30 jours",
  },
  { name: "lp-visite, lp-visite-ref", kind: "Stockage de session (onglet)", category: "Mesure d'audience exemptée", purpose: "Identifiant aléatoire reliant les pages d'une même visite, sans donnée personnelle", duration: "Effacé à la fermeture de l'onglet" },
  { name: "__stripe_mid, __stripe_sid…", kind: "Cookies de Stripe", category: "Strictement nécessaire (paiement)", purpose: "Sécurité et prévention de la fraude, déposés uniquement sur les pages de paiement de Stripe (checkout.stripe.com)", duration: "Selon Stripe" },
];

export default function CookiesPage() {
  return (
    <LegalPage
      title="Politique cookies"
      current="/cookies"
      intro={<p>LinkProB2B n&apos;utilise aucun cookie publicitaire, aucun cookie de réseau social et aucun traceur de mesure d&apos;audience soumis à consentement.</p>}
      sections={[
        {
          id: "inventaire",
          title: "Cookies et traceurs utilisés",
          content: (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-2 pr-3">Nom</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Catégorie</th>
                    <th className="py-2 pr-3">Finalité</th>
                    <th className="py-2">Durée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ITEMS.map((c) => (
                    <tr key={c.name}>
                      <td className="py-2 pr-3">
                        <code>{c.name}</code>
                      </td>
                      <td className="py-2 pr-3">{c.kind}</td>
                      <td className="py-2 pr-3">{c.category}</td>
                      <td className="py-2 pr-3">{c.purpose}</td>
                      <td className="py-2">{c.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
        {
          id: "consentement",
          title: "Pourquoi aucun bandeau de consentement ?",
          content: (
            <>
              <p>
                Les cookies strictement nécessaires au service demandé (connexion, sécurité du paiement) sont exemptés de consentement (article 82 de la loi
                Informatique et Libertés). La mesure d&apos;audience interne ne dépose aucun cookie, n&apos;enregistre ni adresse IP ni compte, sert
                uniquement à des statistiques agrégées et n&apos;est pas croisée avec d&apos;autres traitements : elle relève des conditions d&apos;exemption
                définies par la CNIL. Aucun bandeau n&apos;est donc nécessaire.
              </p>
              <p>Si un outil nécessitant un consentement était ajouté, un bandeau permettant d&apos;accepter ou de refuser aussi simplement serait mis en place au préalable.</p>
            </>
          ),
        },
        {
          id: "mesure-audience",
          title: "Mesure d'audience",
          content: (
            <>
              <p>
                <strong>Mesure interne, sans cookie :</strong> page consultée, site d&apos;origine (par exemple un moteur de recherche), type d&apos;appareil et
                durée de lecture, reliés par un identifiant aléatoire conservé dans l&apos;onglet et effacé à sa fermeture. Données conservées 13 mois. Les
                navigateurs envoyant le signal « Do Not Track » ou « Global Privacy Control » ne sont pas mesurés.
              </p>
              <p>
                <strong>Vercel Web Analytics :</strong> statistiques de fréquentation agrégées et anonymes, sans cookie et sans identifiant persistant (les
                visiteurs ne sont pas suivis d&apos;un site à l&apos;autre ni d&apos;un jour à l&apos;autre).
              </p>
              <p>
                <strong>Vercel Speed Insights :</strong> mesure anonyme de la vitesse d&apos;affichage des pages (temps de chargement, réactivité), sans
                cookie ni identifiant persistant, utilisée uniquement pour améliorer les performances du site.
              </p>
            </>
          ),
        },
        {
          id: "parametrage",
          title: "Paramétrer votre navigateur",
          content: (
            <p>
              Vous pouvez supprimer ou bloquer les cookies depuis les réglages de votre navigateur. Le blocage des cookies strictement nécessaires empêche la
              connexion à votre compte. Pour en savoir plus sur vos données : <Link href="/confidentialite">politique de confidentialité</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}
