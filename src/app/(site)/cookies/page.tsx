import { ContentPage } from "@/components/content-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({ title: "Cookies", description: "Cookies utilisés par LinkProB2B.", path: "/cookies" });

export default function CookiesPage() {
  return (
    <ContentPage title="Cookies" legalDraft updated="octobre 2026">
      <p>LinkProB2B n&apos;utilise que des cookies strictement nécessaires au fonctionnement du service. Ils ne requièrent pas de consentement préalable.</p>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-4">Cookie</th>
              <th className="py-2 pr-4">Finalité</th>
              <th className="py-2">Durée</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-200">
              <td className="py-2 pr-4">
                <code>sb-…-auth-token</code>
              </td>
              <td className="py-2 pr-4">Session de connexion sécurisée</td>
              <td className="py-2">Durée de la session</td>
            </tr>
            <tr className="border-t border-slate-200">
              <td className="py-2 pr-4">
                <code>lp_company</code>
              </td>
              <td className="py-2 pr-4">Entreprise active sélectionnée</td>
              <td className="py-2">Session</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Aucun cookie publicitaire ni de mesure d&apos;audience tiers n&apos;est déposé. Si un outil de mesure d&apos;audience nécessitant un consentement est
        ajouté ultérieurement, un bandeau de choix sera mis en place au préalable.
      </p>
    </ContentPage>
  );
}
