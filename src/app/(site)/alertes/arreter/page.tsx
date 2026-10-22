import { LeadUnsubscribeForm } from "@/components/lead-unsubscribe-form";
import { Notice } from "@/components/ui/notice";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata = { ...PRIVATE_METADATA, title: "Ne plus recevoir ces marchés" };

/** Désinscription de l'alerte par e-mail sans compte (lien présent dans chaque e-mail). */
export default async function LeadUnsubscribePage(props: PageProps<"/alertes/arreter">) {
  const sp = await props.searchParams;
  const token = typeof sp.jeton === "string" ? sp.jeton : "";
  return (
    <div className="container-page max-w-xl py-16">
      <h1 className="text-2xl font-bold">Ne plus recevoir ces marchés</h1>
      <p className="mt-2 mb-6 text-slate-600">Vous ne recevrez plus la sélection hebdomadaire correspondant à cette alerte.</p>
      {token ? <LeadUnsubscribeForm token={token} /> : <Notice tone="error">Lien incomplet.</Notice>}
    </div>
  );
}
