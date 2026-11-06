import { DashboardNav } from "@/components/dashboard/side-nav";
import { CompanySwitcher } from "@/components/dashboard/company-switcher";
import { requireSession } from "@/lib/auth";
import { PRIVATE_METADATA } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui/notice";
import { createAdminClient } from "@/lib/supabase/admin";
import { founderOffer, founderOpen, isFounder } from "@/lib/billing/founder";
import { FounderBanner } from "@/components/billing/founder";

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
  // Offre membre fondateur (seulement une fois lancée) : comptes d'avant le lancement, entreprise à l'offre Gratuite
  const offer = await founderOffer().catch(() => null);
  let founderBanner = false;
  if (offer && founderOpen(offer) && isFounder(offer, session.profile.created_at)) {
    const { data: c } = session.activeCompany ? await createAdminClient().from("companies").select("plan_code").eq("id", session.activeCompany.company.id).maybeSingle() : { data: null };
    founderBanner = !c || c.plan_code === "FREE";
  }
  return (
    <div className="container-page py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Bonjour <strong className="text-navy">{session.profile.full_name || session.email}</strong>
          {session.activeCompany && (
            <>
              {" "}
              · <span className="text-navy">{session.activeCompany.company.name}</span>
            </>
          )}
        </p>
        <CompanySwitcher companies={session.memberships.map((m) => ({ id: m.company.id, name: m.company.name }))} activeId={session.activeCompany?.company.id ?? null} />
      </div>
      {founderBanner && <FounderBanner endsAt={offer!.endsAt} />}
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
  );
}
