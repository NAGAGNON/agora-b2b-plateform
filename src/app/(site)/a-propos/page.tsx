import { ContentPage } from "@/components/content-page";
import { pageMetadata } from "@/lib/seo";
import { PROMISE, SLOGAN } from "@/lib/constants";

export const metadata = pageMetadata({ title: "À propos", description: "LinkProB2B, la plateforme B2B française pour trouver des opportunités, des marchés, des partenaires et des prestataires.", path: "/a-propos" });

export default function AboutPage() {
  return (
    <ContentPage title="À propos de LinkProB2B" intro={SLOGAN}>
      <p>{PROMISE}</p>
      <p>
        LinkProB2B est une plateforme B2B qui met en relation les entreprises qui ont un besoin avec les entreprises capables d&apos;y répondre. Elle combine
        des besoins publiés directement par des entreprises et des opportunités externes référencées, toujours identifiées avec leur source.
      </p>
      <h2>Né en Bretagne, ouvert à toute la France</h2>
      <p>
        LinkProB2B est né en Bretagne, avec une attention particulière au Finistère et aux services techniques aux entreprises. La plateforme couvre
        désormais toute la France — métropole et outre-mer — et l&apos;ensemble des secteurs d&apos;activité.
      </p>
      <h2>Nos principes</h2>
      <ul>
        <li>Transparence sur la provenance de chaque opportunité ;</li>
        <li>Qualité avant volume : modération, signalement, expiration des annonces ;</li>
        <li>Aucune donnée, statistique ou témoignage inventé ;</li>
        <li>Respect des données personnelles et minimisation.</li>
      </ul>
    </ContentPage>
  );
}
