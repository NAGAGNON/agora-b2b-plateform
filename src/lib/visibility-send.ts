import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSettings } from "@/lib/outreach/data";
import type { PresentedCompany } from "@/lib/outreach/data";
import { logServerError } from "@/lib/errors";

type Db = ReturnType<typeof createAdminClient>;
const parisDay = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

/**
 * Offre « Visibilité » (entreprise) : complète chaque jour les présentations faites dans l'espace des
 * entreprises inscrites par des e-mails aux entreprises de la base de prospection qui correspondent au
 * ciblage, jusqu'au nombre quotidien choisi. Les e-mails passent par la file d'envoi de l'Outreach
 * (désinscription, liste d'opposition, délai entre deux contacts, limites d'envoi, pause du week-end) ;
 * rien ne part pour une offre qui n'a pas été validée par l'équipe.
 */
export async function queueBoostPresentations(db: Db = createAdminClient()) {
  const settings = await loadSettings(db);
  const today = parisDay();
  const { data: boosts } = await db.from("visibility_boosts").select("*").eq("status", "ACTIVE").eq("target", "COMPANY").gt("daily_presentations", 0).limit(50);
  let queued = 0;
  for (const b of boosts ?? []) {
    try {
      const { data: pres } = await db.from("boost_presentations").select("created_at").eq("boost_id", b.id).gte("created_at", new Date(Date.now() - 2 * 86_400_000).toISOString());
      const doneToday = (pres ?? []).filter((p) => parisDay(new Date(p.created_at)) === today).length;
      // Campagne de l'offre (une seule), avec la fiche de l'entreprise présentée
      let { data: campaign } = await db.from("outreach_campaigns").select("id").eq("kind", "BOOST").eq("boost_id", b.id).maybeSingle();
      const { count: waiting } = campaign
        ? await db.from("outreach_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id).in("status", ["PENDING", "QUEUED", "SENDING"])
        : { count: 0 };
      const room = b.daily_presentations - doneToday - (waiting ?? 0);
      if (room <= 0) continue;
      if (!campaign) {
        const [{ data: co }, { data: prof }, { data: sectors }] = await Promise.all([
          db.from("companies").select("name, slug, city").eq("id", b.company_id).single(),
          db.from("company_profiles").select("tagline, description, sectors").eq("company_id", b.company_id).maybeSingle(),
          db.from("sectors").select("slug, label"),
        ]);
        const label = new Map((sectors ?? []).map((s) => [s.slug, s.label]));
        const presented: PresentedCompany = {
          name: co!.name,
          slug: co!.slug,
          city: co!.city,
          tagline: prof?.tagline ?? null,
          description: prof?.description ?? null,
          activities: (prof?.sectors ?? []).map((s) => label.get(s) ?? s).slice(0, 3),
          sectorSlug: prof?.sectors?.[0] ?? null,
        };
        const { data: created, error } = await db
          .from("outreach_campaigns")
          .insert({
            campaign_date: today,
            kind: "BOOST",
            boost_id: b.id,
            status: "VALIDATED",
            dry_run: settings.dry_run,
            min_score: 0,
            subject_template: `${co!.name} souhaite se présenter à {entreprise}`,
            intro_template: JSON.stringify(presented),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw error;
        campaign = created;
      }
      const { data: picks, error } = await db.rpc("boost_pick_prospects", { p_boost_id: b.id, p_limit: room, p_min_days: settings.min_days_between_contacts });
      if (error) throw error;
      if (!picks?.length) continue;
      const { data: co } = await db.from("companies").select("name").eq("id", b.company_id).single();
      const { data: names } = await db.from("outreach_prospects").select("id, name").in("id", picks.map((p) => p.id));
      const nameOf = new Map((names ?? []).map((n) => [n.id, n.name]));
      const rows = picks.map((p) => ({
        campaign_id: campaign!.id,
        prospect_id: p.id,
        email: p.email,
        score: 100,
        reasons: ["Ciblage choisi par l'entreprise présentée"],
        status: "PENDING",
        subject: `${co?.name ?? "Une entreprise"} souhaite se présenter à ${nameOf.get(p.id) ?? "votre entreprise"}`.slice(0, 200),
      }));
      const { error: insErr } = await db.from("outreach_recipients").upsert(rows, { onConflict: "campaign_id,prospect_id", ignoreDuplicates: true });
      if (insErr) throw insErr;
      await db.from("outreach_campaigns").update({ status: "VALIDATED", updated_at: new Date().toISOString() }).eq("id", campaign!.id).in("status", ["SENT", "SIMULATED"]);
      queued += rows.length;
    } catch (e) {
      logServerError(`visibility emails ${b.id}`, e);
    }
  }
  return { emails_en_file: queued };
}
