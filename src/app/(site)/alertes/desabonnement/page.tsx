import { UnsubscribeForm } from "@/components/public-forms";
import { Notice } from "@/components/ui/notice";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata = { ...PRIVATE_METADATA, title: "Se désabonner d'une alerte" };

export default async function UnsubscribePage(props: PageProps<"/alertes/desabonnement">) {
  const sp = await props.searchParams;
  const token = typeof sp.jeton === "string" ? sp.jeton : "";
  return (
    <div className="container-page max-w-xl py-16">
      <h1 className="text-2xl font-bold">Se désabonner d&apos;une alerte</h1>
      <p className="mt-2 mb-6 text-slate-600">Vous ne recevrez plus d&apos;e-mails pour cette alerte. Vous pourrez la réactiver depuis votre espace.</p>
      {token ? <UnsubscribeForm token={token} /> : <Notice tone="error">Lien incomplet.</Notice>}
    </div>
  );
}
