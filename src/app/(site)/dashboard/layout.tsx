import { DashboardNav } from "@/components/dashboard/side-nav";
import { CompanySwitcher } from "@/components/dashboard/company-switcher";
import { requireSession } from "@/lib/auth";
import { PRIVATE_METADATA } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui/notice";
import { createAdminClient } from "@/lib/supabase/admin";
import { companyOfferState, founderOffer, founderOpen, founderSeatsTaken, marketPulse, seatsLeft } from "@/lib/billing/founder";
import { LaunchCard, type LaunchCardProps } from "@/components/billing/launch-card";
import { CompanySetupBanner } from "@/components/dashboard/company-setup-banner";
import { getPlatformStats } from "@/lib/queries/platform";

const nowMs = () => Date.now();

export const metadata = PRIVATE_METADATA;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession("/dashboard");
  const supabase = await createClient();
  const ids = session.memberships.map((m) => m.company.id);
  const { count } = ids.length
    ? await supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).not("sender_company_id", "in", `(${ids.join(",")})`)
    : { count: 0 };
  // Dernière activité et jour de visite (« depuis votre dernière visite », taux de retour), sans autre donnée.
  void supabase.rpc("touch_visit").then(() => {});
  // Offre de lancement (seulement une fois lancée) : encart adapté à chaque membre (essai, jours restants, tarif fondateur)
  const offer = await founderOffer().catch(() => null);
  let launch: LaunchCardProps | null = null;
  if (offer && founderOpen(offer)) {
    const db = createAdminClient();
    const companyId = session.activeCompany?.company.id ?? null;
    const [state, pulse, taken] = await Promise.all([
      companyId ? companyOfferState(companyId, db) : Promise.resolve(null),
      companyId ? marketPulse(companyId, db) : Promise.resolve(null),
      founderSeatsTaken(db),
    ]);
    launch = { state, pulse, seatsLeft: seatsLeft(offer, taken), endsAt: offer.endsAt, now: nowMs() };
  }
  // Sans fiche entreprise, le site ne peut rien trier pour le membre : bandeau sur toutes les pages de l'espace
  const openCount = session.activeCompany ? 0 : ((await getPlatformStats().catch(() => null))?.active ?? 0);
  return (
    <div className="relative isolate">
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem] bg-gradient-to-b from-sky/70 via-slate-50/60 to-transparent" />
    <div className="container-page py-6 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Espace de <strong className="text-navy">{session.profile.full_name || session.email}</strong>
          {session.activeCompany && (
            <>
              {" "}
              · <span className="text-navy">{session.activeCompany.company.name}</span>
            </>
          )}
        </p>
        <CompanySwitcher companies={session.memberships.map((m) => ({ id: m.company.id, name: m.company.name }))} activeId={session.activeCompany?.company.id ?? null} />
      </div>
      {!session.activeCompany && <CompanySetupBanner openCount={openCount} />}
      {launch && <LaunchCard {...launch} />}
      {session.activeCompany?.company.status === "SUSPENDED" && (
        <Notice tone="error" className="mb-6" title="Entreprise suspendue">
          Votre entreprise a été suspendue par la modération : ses publications ne sont plus visibles et certaines actions sont désactivées.
        </Notice>
      )}
      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <DashboardNav unreadMessages={count ?? 0} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
    </div>
  );
}
