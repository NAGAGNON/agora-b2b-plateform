import Link from "next/link";
import { safeInternalPath } from "@/lib/safe-path";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/forms";
import { GoogleButton } from "@/components/auth/google-button";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import { recipientFromReferral, referralStillTrusted } from "@/lib/outreach/tracking";
import { visitorRpc } from "@/lib/queries/public-cache";
import { getOpenCounts } from "@/lib/queries/platform";
import { formatDate } from "@/lib/format";
import { CalendarClock, Lock, MapPin } from "lucide-react";

export const metadata = pageMetadata({
  title: "Créer un compte",
  description: "Créez gratuitement votre compte LinkProB2B pour suivre les opportunités B2B et appels d'offres de votre secteur, partout en France.",
  path: "/inscription",
});

const internalPath = (v: unknown) => safeInternalPath(v, "") || undefined;

export default async function SignUpPage(props: PageProps<"/inscription">) {
  const sp = await props.searchParams;
  // Page à ouvrir après l'inscription (ex. l'offre recommandée dans un e-mail de prospection)
  const next = internalPath(sp.suite);
  if (await getSession()) redirect(next ?? "/dashboard");
  const ref = sp.ref;
  // Provenance (sélection LinkProB2B Outreach) : jeton signé, vérifié côté serveur à l'inscription.
  const referral = typeof ref === "string" && /^o\.[A-Za-z0-9_.-]{20,60}$/.test(ref) ? ref : undefined;
  const forOffer = Boolean(referral && next?.startsWith("/opportunites/"));
  // Lien reçu par e-mail : l'adresse destinataire est pré-remplie (activation immédiate du compte)
  const recipient = referral ? await recipientFromReferral(referral) : null;
  // Sinon : adresse transmise par un lien LinkProB2B (alerte par e-mail confirmée), simple pré-remplissage
  const fromLink = typeof sp.email === "string" && /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i.test(sp.email) ? sp.email : undefined;
  const defaultEmail = recipient?.email && referralStillTrusted(recipient) ? recipient.email : fromLink;
  // Aperçu concret de ce qui attend le visiteur (chiffres et offres réels, en cache) : la plupart
  // arrivent ici depuis la liste des opportunités, réservée aux membres
  const [count, latest] = forOffer
    ? [null, null]
    : await Promise.all([
        getOpenCounts().catch(() => null),
        visitorRpc("search_opportunities", { p_status: "OPEN", p_sort: "recent", p_limit: 3, p_include_demo: false }, { always: true }).then((r) => r.data ?? []).catch(() => []),
      ]);
  const total = count ? count("total", "") : 0;
  const fromList = next === "/opportunites" || next?.startsWith("/opportunites?") || next === "/entreprises";
  return (
    <AuthShell
      aside={false}
      title={forOffer ? "Créez votre compte pour accéder à cette offre" : "Créer un compte"}
      subtitle={
        forOffer
          ? "Gratuit. Utilisez l'adresse qui a reçu notre e-mail : votre compte est activé immédiatement et l'offre s'ouvre directement."
          : "Gratuit et sans carte bancaire. Accédez aux opportunités B2B de toute la France."
      }
      footer={
        <>
          Déjà inscrit ?{" "}
          <Link
            href={`/connexion${next ? `?${new URLSearchParams({ suite: next, ...(referral ? { ref: referral } : {}) })}` : ""}`}
            className="font-semibold text-teal-700 hover:underline"
          >
            Se connecter
          </Link>
        </>
      }
    >
      {sp.erreur === "google" && (
        <Notice tone="warning" title="Connexion Google indisponible" className="mb-6">
          Réessayez, ou créez votre compte avec votre adresse e-mail.
        </Notice>
      )}
      {!forOffer && total > 0 && latest && latest.length > 0 && (
        <section aria-label="Aperçu des opportunités" className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-navy">
            {fromList ? "La liste complète est réservée aux membres : " : ""}
            <span className="text-teal-700">{total.toLocaleString("fr-FR")} appels d&apos;offres et opportunités ouverts</span> en ce moment, dont les plus récents :
          </p>
          <ul className="mt-3 space-y-2">
            {latest.map((o) => (
              <li key={o.id} className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                <p className="line-clamp-1 font-medium text-navy">{o.title}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                  {o.department_code && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" aria-hidden /> {o.city || o.department_code}
                    </span>
                  )}
                  {o.response_deadline && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3" aria-hidden /> avant le {formatDate(o.response_deadline)}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
            <Lock className="size-3.5 text-teal-700" aria-hidden /> Compte gratuit : accès aux offres complètes et alertes de votre métier par e-mail.
          </p>
        </section>
      )}
      <SignUpForm referral={referral} next={next} defaultEmail={defaultEmail} />
      <GoogleButton next={next} referral={referral} />
    </AuthShell>
  );
}
