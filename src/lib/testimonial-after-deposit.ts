import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { isWeekendPause } from "@/lib/weekend";

/**
 * Demande d'avis après un dépôt de candidature (validée par le fondateur le 20/11) : quand un membre
 * indique avoir déposé sa réponse à un appel d'offres trouvé sur LinkProB2B, il reçoit une seule
 * demande d'avis, en semaine. Jamais deux demandes initiales : la ligne testimonial_requests sert de
 * verrou, et le rappel unique éventuel reste celui de process_testimonial_requests.
 */
export async function requestReviewsAfterDeposit(db: SupabaseClient<Database>, now = new Date()): Promise<{ demandes: number }> {
  if (isWeekendPause(now)) return { demandes: 0 };
  const { data: items, error } = await db
    .from("pipeline_items")
    .select("company_id, submitted_at, opportunity:opportunities!inner(title, external_buyer_name)")
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  if (!items?.length) return { demandes: 0 };

  const companyIds = [...new Set(items.map((i) => i.company_id))];
  const [{ data: members }, { data: companyRows }] = await Promise.all([
    db.from("company_members").select("user_id, company_id").in("company_id", companyIds),
    db.from("companies").select("id, name").in("id", companyIds),
  ]);
  const companyName = new Map((companyRows ?? []).map((c) => [c.id, c.name.toLowerCase()]));
  const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
  if (!userIds.length) return { demandes: 0 };
  const [{ data: users }, { data: asked }, { data: given }] = await Promise.all([
    db.from("users").select("id, email, full_name, status, is_internal, is_demo, platform_role, notify_email").in("id", userIds),
    db.from("testimonial_requests").select("user_id").in("user_id", userIds),
    db.from("testimonials").select("user_id").in("user_id", userIds),
  ]);
  const skip = new Set([...(asked ?? []).map((r) => r.user_id), ...(given ?? []).map((r) => r.user_id)]);

  let n = 0;
  for (const u of users ?? []) {
    if (skip.has(u.id) || u.status !== "ACTIVE" || u.is_internal || u.is_demo || u.platform_role !== "USER" || !u.notify_email || !u.email) continue;
    const companies = new Set((members ?? []).filter((m) => m.user_id === u.id).map((m) => m.company_id));
    const item = items.find((i) => companies.has(i.company_id));
    if (!item) continue;
    // Verrou : une seule demande par personne, même si deux passages tournent en même temps
    const { data: lock } = await db.from("testimonial_requests").insert({ user_id: u.id }).select("user_id");
    if (!lock?.length) continue;
    const o = (Array.isArray(item.opportunity) ? item.opportunity[0] : item.opportunity) as { title: string; external_buyer_name: string | null };
    const what = o.external_buyer_name ? `l'appel d'offres de ${o.external_buyer_name}` : `l'appel d'offres « ${o.title.length > 90 ? `${o.title.slice(0, 87)}…` : o.title} »`;
    // Prénom seulement si le nom saisi est celui d'une personne (pas le nom de l'entreprise)
    const full = (u.full_name ?? "").trim().toLowerCase();
    const isCompany = !full || [...companies].some((c) => (companyName.get(c) ?? "").includes(full) || full.includes(companyName.get(c) ?? "\u0000"));
    const first = isCompany ? "" : (u.full_name ?? "").trim().split(/\s+/)[0];
    await db.from("email_outbox").insert({
      user_id: u.id,
      to_email: u.email,
      template: "testimonial_request",
      subject: "Votre avis sur LinkProB2B (1 minute)",
      payload: {
        type: "testimonial_request",
        title: "Votre avis compte pour nous",
        paragraphs: [
          `Bonjour${first ? ` ${first}` : ""},`,
          `Vous avez trouvé ${what} sur LinkProB2B et vous y avez répondu : bravo, et merci de nous avoir fait confiance !`,
          "Accepteriez-vous de donner une note sur 5 étoiles à LinkProB2B et, si vous le souhaitez, un mot sur ce que le site vous a apporté ou sur ce qui vous a manqué ? Cela prend moins d'une minute et nous aide à l'améliorer.",
          "Si vous le souhaitez, et seulement avec votre accord, votre avis pourra aussi être affiché sur le site pour aider d'autres entreprises à nous découvrir.",
        ],
        link: "/avis",
      },
    });
    n++;
  }
  return { demandes: n };
}
