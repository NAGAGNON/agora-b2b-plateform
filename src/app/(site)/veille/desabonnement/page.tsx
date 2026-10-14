import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, MailX } from "lucide-react";
import { confirmVeilleUnsubscribe } from "@/app/actions/veille";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendFromToken } from "@/lib/veille/tracking";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata: Metadata = { ...PRIVATE_METADATA, title: "Se désabonner de la veille" };

/** Désinscription de la veille par e-mail : sans connexion, immédiate, le compte est conservé. */
export default async function VeilleUnsubscribePage(props: PageProps<"/veille/desabonnement">) {
  const sp = await props.searchParams;
  const token = typeof sp.jeton === "string" ? sp.jeton : "";
  const s = await sendFromToken(token);
  const done = sp.ok === "1" || Boolean(s?.unsubscribed_at);
  return (
    <div className="container-page max-w-xl py-14">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {!s ? (
          <>
            <h1 className="text-2xl font-bold">Lien invalide</h1>
            <p className="mt-3 text-slate-600">
              Ce lien n&apos;est pas reconnu. Connectez-vous et gérez votre veille dans{" "}
              <Link href="/dashboard/veille" className="font-semibold text-teal-700 underline">
                votre espace
              </Link>
              , ou écrivez-nous via la page{" "}
              <Link href="/contact" className="font-semibold text-teal-700 underline">
                Contact
              </Link>
              .
            </p>
          </>
        ) : done ? (
          <>
            <CheckCircle2 className="size-10 text-teal-600" aria-hidden />
            <h1 className="mt-3 text-2xl font-bold">Désinscription confirmée</h1>
            <p className="mt-3 text-slate-600">
              Vous ne recevrez plus la veille LinkProB2B par e-mail. Votre compte reste actif ; vous pouvez réactiver la veille à tout moment depuis votre espace.
            </p>
            <Link href="/dashboard/veille" className="mt-6 inline-block font-semibold text-teal-700 underline">
              Gérer mes préférences
            </Link>
          </>
        ) : (
          <>
            <MailX className="size-10 text-navy" aria-hidden />
            <h1 className="mt-3 text-2xl font-bold">Ne plus recevoir la veille par e-mail</h1>
            <p className="mt-3 text-slate-600">
              En confirmant, l&apos;adresse <strong className="text-navy">{s.email}</strong> ne recevra plus les sélections ni les alertes quotidiennes de la veille. Les
              e-mails indispensables à votre compte (sécurité, messages) ne sont pas concernés.
            </p>
            <form action={confirmVeilleUnsubscribe} className="mt-6">
              <input type="hidden" name="jeton" value={token} />
              <SubmitButton size="lg" pendingLabel="Enregistrement…">
                Confirmer la désinscription
              </SubmitButton>
            </form>
            <p className="mt-4 text-sm text-slate-500">
              Vous préférez recevoir moins ou plus d&apos;e-mails ?{" "}
              <Link href="/dashboard/veille" className="font-semibold text-teal-700 underline">
                Modifier la fréquence
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
