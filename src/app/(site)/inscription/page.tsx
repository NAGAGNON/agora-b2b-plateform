import Link from "next/link";
import { safeInternalPath } from "@/lib/safe-path";
import { redirect } from "next/navigation";
import { SignupAside } from "@/components/auth/signup-aside";
import { SignUpForm } from "@/components/auth/forms";
import { GoogleButton } from "@/components/auth/google-button";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import { recipientFromReferral, referralStillTrusted } from "@/lib/outreach/tracking";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/errors";
import { getMemberCompanies, getOpenCounts, getPlatformStats, liveStats } from "@/lib/queries/platform";
import { MemberProofCompact } from "@/components/home/member-proof";
import { Lock } from "lucide-react";
import { founderOffer, founderOpen } from "@/lib/billing/founder";

export const metadata = pageMetadata({
  title: "Créer un compte",
  description: "Créez gratuitement votre compte LinkProB2B pour suivre les opportunités B2B et appels d'offres de votre secteur, partout en France.",
  path: "/inscription",
});

const internalPath = (v: unknown) => safeInternalPath(v, "") || undefined;

/** Trois offres publiques ouvertes les plus récentes (aperçu de la page d'inscription), en cache 10 minutes. */
const latestOpenOffers = unstable_cache(
  async () => {
    const { data, error } = await createAdminClient()
      .from("opportunities")
      .select("id, title, city, department_code, response_deadline")
      .eq("status", "PUBLISHED")
      .eq("visibility", "PUBLIC")
      .eq("is_demo", false)
      .gt("response_deadline", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(3);
    // Erreur : rien n'est mis en cache, nouvel essai à la visite suivante
    if (error) throw error;
    return data ?? [];
  },
  ["signup-latest-offers-v1"],
  { revalidate: 600 },
);

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
        getOpenCounts().catch((e) => {
          logServerError("signup preview counts", e);
          return null;
        }),
        latestOpenOffers().catch((e) => {
          logServerError("signup preview", e);
          return [];
        }),
      ]);
  const total = count ? count("total", "") : 0;
  const [platform, memberCompanies] = forOffer ? [null, []] : await Promise.all([getPlatformStats().catch(() => null), getMemberCompanies(12).catch(() => [])]);
  const live = liveStats(platform);
  const launch = founderOpen(await founderOffer().catch(() => ({ enabled: false, launchedAt: null, endsAt: null, seats: 0 })));
  const fromList = next === "/opportunites" || next?.startsWith("/opportunites?") || next === "/entreprises";
  const signInHref = `/connexion${next ? `?${new URLSearchParams({ suite: next, ...(referral ? { ref: referral } : {}) })}` : ""}`;
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex items-start justify-center px-4 py-10 sm:px-8 sm:py-14 lg:py-16">
        <div className="w-full max-w-md">
          <h1 className="font-heading text-3xl leading-tight font-extrabold text-navy sm:text-4xl">
            {forOffer ? (
              <>
                Créez votre compte <span className="block text-teal-700">pour accéder à cette offre.</span>
              </>
            ) : (
              <>
                Créez votre compte <span className="block text-teal-700">et trouvez vos prochains clients.</span>
              </>
            )}
          </h1>
          <p className="mt-3 text-slate-600">
            {forOffer
              ? "Gratuit. Utilisez l'adresse qui a reçu notre e-mail : votre compte est activé immédiatement et l'offre s'ouvre directement."
              : "Gratuit et sans carte bancaire. Appels d'offres publics et besoins d'entreprises de toute la France, dans votre métier."}
          </p>
          {launch && !forOffer && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-navy p-4 text-white ring-1 ring-white/10" data-testid="signup-trial">
              <span className="inline-flex size-10 shrink-0 animate-float items-center justify-center rounded-xl bg-gradient-to-br from-teal to-violet text-sm font-bold">14 j</span>
              <p className="text-sm">
                <strong>Pro offert 14 jours</strong> : chaque appel d&apos;offres résumé en 30 secondes, besoins en avant-première. Sans carte.
              </p>
            </div>
          )}
          {sp.erreur === "google" && (
            <Notice tone="warning" title="Connexion Google indisponible" className="mt-6">
              Réessayez, ou créez votre compte avec votre adresse e-mail.
            </Notice>
          )}
          <GoogleButton next={next} referral={referral} placement="top" />
          <div className="mt-6">
            <SignUpForm referral={referral} next={next} defaultEmail={defaultEmail} />
          </div>
          <p className="mt-6 text-center text-sm text-slate-600">
            Vous avez déjà un compte ?{" "}
            <Link href={signInHref} className="font-semibold text-teal-700 hover:underline">
              Se connecter
            </Link>
          </p>
          {/* Téléphone : la preuve d'activité passe sous le formulaire (le panneau de droite est masqué) */}
          {!forOffer && (
            <div className="mt-8 space-y-4 lg:hidden">
              {total > 0 && (
                <p className="flex items-center gap-1.5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                  <Lock className="size-4 shrink-0 text-teal-700" aria-hidden />
                  {fromList ? "La liste complète est réservée aux membres : " : ""}
                  {total.toLocaleString("fr-FR")} appels d&apos;offres et opportunités ouverts en ce moment.
                </p>
              )}
              {live && <MemberProofCompact initial={live} companies={memberCompanies} />}
            </div>
          )}
        </div>
      </div>
      {!forOffer && <SignupAside total={total} latest={latest ?? []} live={live} companies={memberCompanies} />}
      {forOffer && <div className="hidden bg-gradient-to-br from-sky via-white to-teal-50 lg:block" aria-hidden />}
    </div>
  );
}
