import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { ButtonLink } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo";
import { FORMULAS } from "@/lib/visibility";
import { freeLaunch } from "@/lib/billing/entitlements";
import { JsonLd, breadcrumbLd } from "@/components/json-ld";
import { siteUrl } from "@/lib/seo";

const FAQ = [
  { q: "Qui reçoit ma présentation ?", a: "Les entreprises que vous ciblez : par région, métier, taille et type d'entreprise. Le nombre d'entreprises correspondantes s'affiche pendant que vous choisissez." },
  { q: "Comment les entreprises me contactent-elles ?", a: "Par la messagerie de LinkProB2B : votre annonce ne contient ni téléphone ni e-mail, et chaque message arrive dans votre espace." },
  { q: "Que se passe-t-il si ma campagne n'atteint pas le nombre d'entreprises prévu ?", a: "Elle est prolongée une fois, automatiquement, pour compléter les présentations manquantes." },
  { q: "Puis-je suivre les résultats ?", a: "Oui : votre espace indique combien d'entreprises ont reçu votre présentation, l'ont lue, ont cliqué sur votre fiche et vous ont écrit." },
];

export const metadata = pageMetadata({
  title: "On fait votre prospection pour vous",
  description:
    "Présentez votre entreprise chaque jour à des entreprises ciblées (métier, région, taille), suivez qui a lu et cliqué, et recevez les demandes dans votre messagerie.",
  path: "/prospection",
});

export default async function ProspectionPage() {
  const free = await freeLaunch();
  return (
    <ContentPage
      eyebrow="Campagnes de visibilité"
      image="/images/illustrations/poignee-de-main.webp"
      title="On fait votre prospection pour vous"
      intro="Vous écrivez une courte annonce, vous choisissez les entreprises à toucher : nous la leur présentons chaque jour, et vous suivez les résultats."
    >
      <h2>Comment ça marche</h2>
      <ol>
        <li>
          <strong>Votre objectif</strong> : trouver des clients, des sous-traitants ou des partenaires.
        </li>
        <li>
          <strong>Votre ciblage</strong> : les régions, les métiers, la taille et le type des entreprises à qui vous voulez être présenté. Le nombre
          d&apos;entreprises correspondantes s&apos;affiche pendant que vous choisissez.
        </li>
        <li>
          <strong>Votre annonce</strong> : un titre, jusqu&apos;à 3 points forts et un court texte. Un bouton vous aide à l&apos;écrire plus clairement, sans
          rien inventer. Notre équipe la relit avant le premier envoi.
        </li>
        <li>
          <strong>Les présentations</strong> : chaque jour, des entreprises ciblées reçoivent votre présentation par e-mail. Pendant la campagne, votre
          entreprise apparaît aussi sur les pages d&apos;opportunités et sur la page des entreprises disponibles.
        </li>
        <li>
          <strong>Les contacts</strong> : les entreprises intéressées vous écrivent par la messagerie du site.
        </li>
      </ol>

      <h2>Vous suivez tout</h2>
      <p>Dans votre espace, vous voyez combien d&apos;entreprises ont reçu votre présentation, l&apos;ont lue, ont cliqué sur votre fiche et vous ont écrit.</p>

      <h2>Les formules</h2>
      <ul>
        {FORMULAS.map((f) => (
          <li key={f.key}>
            <strong>{f.label}</strong> : {f.daily} entreprises présentées par jour pendant {f.duration} jours, soit environ {f.daily * f.duration} entreprises
            {f.featured > 0 && <>, avec {f.featured} jours de mise en avant</>}.
          </li>
        ))}
      </ul>
      {free && (
        <p>
          <strong>Offert pendant le lancement</strong> : les campagnes sont gratuites pour le moment.
        </p>
      )}
      <p>
        <strong>Garantie</strong> : si votre campagne n&apos;a pas été présentée au nombre d&apos;entreprises prévu, elle est prolongée une fois,
        automatiquement.
      </p>

      <h2>Questions fréquentes</h2>
      {FAQ.map((f) => (
        <div key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}

      <h2>Ce que nous ne faisons pas</h2>
      <ul>
        <li>Pas de promesse de résultat ni de « clients garantis » ;</li>
        <li>Pas de revente de vos données ;</li>
        <li>Pas de démarchage en votre nom sans relecture de votre annonce.</li>
      </ul>

      <div className="mt-6 flex flex-wrap gap-3 not-prose">
        <ButtonLink href="/inscription?suite=/dashboard/visibilite">Lancer ma campagne</ButtonLink>
        <ButtonLink href="/tarifs" variant="outline">
          Voir les tarifs
        </ButtonLink>
      </div>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Accueil", path: "/" },
            { name: "On fait votre prospection pour vous", path: "/prospection" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: "Campagnes de visibilité B2B",
            serviceType: "Prospection B2B",
            areaServed: { "@type": "Country", name: "France" },
            provider: { "@type": "Organization", name: "LinkProB2B", url: siteUrl() },
            url: `${siteUrl()}/prospection`,
            description: "Présentation quotidienne de votre entreprise à des entreprises ciblées (métier, région, taille), avec suivi des lectures, clics et messages.",
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ]}
      />
      <p className="mt-4 text-sm">
        Déjà inscrit ? <Link href="/dashboard/visibilite">Créer ma campagne</Link>
      </p>
    </ContentPage>
  );
}
