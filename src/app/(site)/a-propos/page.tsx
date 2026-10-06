import { ContentPage } from "@/components/content-page";
import { pageMetadata } from "@/lib/seo";
import { PROMISE, SLOGAN } from "@/lib/constants";

export const metadata = pageMetadata({ title: "À propos", description: "LinkProB2B, plateforme B2B pilote en Bretagne.", path: "/a-propos" });

export default function AboutPage() {
  return (
    <ContentPage title="À propos de LinkProB2B" intro={SLOGAN}>
      <p>{PROMISE}</p>
      <p>
        LinkProB2B est une plateforme B2B qui met en relation les entreprises qui ont un besoin avec les entreprises capables d&apos;y répondre. Elle combine
        des besoins publiés directement par des entreprises et des opportunités externes référencées, toujours identifiées avec leur source.
      </p>
      <h2>Un pilote en Bretagne</h2>
      <p>
        Le premier pilote se déroule en Bretagne, avec une priorité sur le Finistère et sur la maintenance industrielle et les services techniques aux
        entreprises. La plateforme est conçue pour s&apos;étendre ensuite à d&apos;autres secteurs et territoires.
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
