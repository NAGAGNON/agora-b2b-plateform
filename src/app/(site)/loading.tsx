import { PageSkeleton } from "@/components/ui/page-skeleton";

/**
 * Affiché immédiatement au clic sur un lien (et préchargé avec la page) : la navigation répond
 * tout de suite, le contenu arrive dès que le serveur l'a calculé.
 */
export default function Loading() {
  return (
    // Hauteur d'un écran : le pied de page reste hors de vue pendant le chargement (pas de « saut » de la page)
    <div className="container-page min-h-dvh py-8 sm:py-10">
      <PageSkeleton />
    </div>
  );
}
