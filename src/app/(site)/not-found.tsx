import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page max-w-2xl py-16">
      <EmptyState
        icon={<SearchX className="size-6" aria-hidden />}
        title="Page introuvable"
        description="Cette page n'existe pas, a été retirée, ou est réservée aux membres connectés."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/opportunites">Explorer les opportunités</ButtonLink>
            <ButtonLink href="/connexion" variant="outline">
              Se connecter
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
