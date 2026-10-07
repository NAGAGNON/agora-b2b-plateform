import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, MailX } from "lucide-react";
import { confirmUnsubscribe } from "@/app/actions/outreach-public";
import { SubmitButton } from "@/components/ui/submit-button";
import { recipientFromToken } from "@/lib/outreach/tracking";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata: Metadata = { ...PRIVATE_METADATA, title: "Ne plus recevoir nos sélections" };

/** Désinscription des sélections LinkProB2B Outreach : simple, sans compte, définitive. */
export default async function UnsubscribePage(props: PageProps<"/desinscription/[token]">) {
  const { token } = await props.params;
  const done = (await props.searchParams).ok === "1";
  const r = await recipientFromToken(token);
  return (
    <div className="container-page max-w-xl py-14">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {!r ? (
          <>
            <h1 className="text-2xl font-bold">Lien invalide ou expiré</h1>
            <p className="mt-3 text-slate-600">
              Ce lien de désinscription n&apos;est pas reconnu. Écrivez-nous via la{" "}
              <Link href="/contact?objet=desinscription" className="font-semibold text-teal-700 underline">
                page Contact
              </Link>{" "}
              : nous retirerons votre adresse sans délai.
            </p>
          </>
        ) : done || r.unsubscribed_at ? (
          <>
            <CheckCircle2 className="size-10 text-teal-600" aria-hidden />
            <h1 className="mt-3 text-2xl font-bold">Désinscription confirmée</h1>
            <p className="mt-3 text-slate-600">
              Votre entreprise ne recevra plus aucune sélection d&apos;opportunités de notre part. Votre adresse a été ajoutée à notre liste d&apos;exclusion.
            </p>
            <Link href="/" className="mt-6 inline-block font-semibold text-teal-700 underline">
              Retour à l&apos;accueil
            </Link>
          </>
        ) : (
          <>
            <MailX className="size-10 text-navy" aria-hidden />
            <h1 className="mt-3 text-2xl font-bold">Ne plus recevoir nos sélections d&apos;opportunités</h1>
            <p className="mt-3 text-slate-600">
              En confirmant, l&apos;adresse {r.email ? <strong className="text-navy">{r.email}</strong> : "de votre entreprise"} ne recevra plus aucune sélection
              LinkProB2B. Aucun compte n&apos;est nécessaire.
            </p>
            <form action={confirmUnsubscribe} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <SubmitButton size="lg" pendingLabel="Enregistrement…">
                Confirmer la désinscription
              </SubmitButton>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
