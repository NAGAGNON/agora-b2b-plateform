import Link from "next/link";
import { LegalPage, Todo } from "@/components/legal-page";
import { LEGAL, legalValue } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Mentions légales", description: "Éditeur, hébergement et propriété intellectuelle du site LinkProB2B.", path: "/mentions-legales" });

const v = (value: string | null, label: string) => (value ? value : <Todo>{legalValue(value, label)}</Todo>);

export default function LegalNoticePage() {
  return (
    <LegalPage
      title="Mentions légales"
      current="/mentions-legales"
      intro={<p>Informations prévues par l&apos;article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l&apos;économie numérique.</p>}
      sections={[
        {
          id: "editeur",
          title: "Éditeur du site",
          content: (
            <>
              <p>
                Le site {LEGAL.website.replace("https://", "")} (« {LEGAL.brand} ») est édité par :
              </p>
              <ul>
                <li>Dénomination : {v(LEGAL.companyName, "dénomination sociale ou nom de l'entrepreneur")}</li>
                <li>Forme juridique : {v(LEGAL.legalForm, "forme juridique")}</li>
                {LEGAL.legalForm !== "EI" && <li>Capital social : {v(LEGAL.shareCapital, "capital social (sociétés uniquement)")}</li>}
                <li>Adresse : {v(LEGAL.address, "adresse du siège social")}</li>
                <li>SIRET : {v(LEGAL.siret, "numéro SIRET")}</li>
                <li>Immatriculation : {v(LEGAL.rcs, "RCS ou RNE")}</li>
                <li>TVA intracommunautaire : {v(LEGAL.vatNumber, "numéro de TVA intracommunautaire")}</li>
                <li>E-mail : {v(LEGAL.contactEmail, "adresse e-mail de contact")}</li>
                <li>Téléphone : {v(LEGAL.phone, "numéro de téléphone")}</li>
              </ul>
              <p>
                Vous pouvez également nous écrire via la <Link href="/contact">page Contact</Link>.
              </p>
            </>
          ),
        },
        {
          id: "directeur-publication",
          title: "Directeur de la publication",
          content: <p>{v(LEGAL.publicationDirector, "nom du directeur de la publication")}</p>,
        },
        {
          id: "hebergement",
          title: "Hébergement",
          content: (
            <>
              <p>
                <strong>Application :</strong> Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis —{" "}
                <a href="https://vercel.com" rel="noopener noreferrer" target="_blank">
                  vercel.com
                </a>{" "}
                (coordonnées publiées par Vercel sur{" "}
                <a href="https://vercel.com/legal" rel="noopener noreferrer" target="_blank">
                  vercel.com/legal
                </a>
                ).
              </p>
              <p>
                <strong>Base de données, comptes et fichiers :</strong> Supabase, Inc. —{" "}
                <a href="https://supabase.com" rel="noopener noreferrer" target="_blank">
                  supabase.com
                </a>{" "}
                ; région d&apos;hébergement : {v(LEGAL.supabaseRegion, "région Supabase du projet")}.
              </p>
            </>
          ),
        },
        {
          id: "propriete-intellectuelle",
          title: "Propriété intellectuelle",
          content: (
            <>
              <p>
                La marque {LEGAL.brand}, son logo, la structure du site et ses contenus éditoriaux (textes, guides, analyses) sont protégés par le droit de
                la propriété intellectuelle. Toute reproduction non autorisée est interdite.
              </p>
              <p>
                Les contenus publiés par les utilisateurs (fiches entreprises, besoins, réponses, documents) restent la propriété de leurs auteurs, qui en sont
                responsables. Les opportunités externes sont reprises de sources publiques identifiées sur chaque annonce (BOAMP — Direction de
                l&apos;information légale et administrative ; TED — Office des publications de l&apos;Union européenne), selon leurs conditions de
                réutilisation.
              </p>
            </>
          ),
        },
        {
          id: "responsabilite",
          title: "Responsabilité",
          content: (
            <>
              <p>
                {LEGAL.brand} est un service de mise en relation entre professionnels. Il ne garantit ni l&apos;obtention de contrats ou de marchés, ni un
                résultat commercial. Les informations publiées par les utilisateurs relèvent de leur seule responsabilité.
              </p>
              <p>
                Les opportunités externes (marchés publics) sont publiées par leurs acheteurs sur des sites officiels : {LEGAL.brand} n&apos;en est pas
                l&apos;éditeur et l&apos;avis officiel, accessible depuis chaque annonce, fait foi.
              </p>
            </>
          ),
        },
        {
          id: "signalement",
          title: "Signalement d'un contenu",
          content: (
            <p>
              Tout contenu illicite, trompeur ou erroné peut être signalé via le bouton « Signaler » présent sur les publications ou via la{" "}
              <Link href="/contact?objet=signalement">page Contact</Link>. Les signalements sont examinés par l&apos;équipe de modération.
            </p>
          ),
        },
        {
          id: "documents",
          title: "Autres documents",
          content: (
            <ul>
              <li>
                <Link href="/cgu">Conditions générales d&apos;utilisation</Link>
              </li>
              <li>
                <Link href="/confidentialite">Politique de confidentialité</Link>
              </li>
              <li>
                <Link href="/cookies">Politique cookies</Link>
              </li>
              <li>
                <Link href="/conditions-abonnement">Conditions d&apos;abonnement</Link>
              </li>
            </ul>
          ),
        },
      ]}
    />
  );
}
