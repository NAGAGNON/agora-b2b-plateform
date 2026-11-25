import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_MODEL } from "@/lib/daily-report";
import { logServerError } from "@/lib/errors";

const NONE = "aucun";

/**
 * Métier des offres que les règles de classement n'ont pas su ranger : un tri automatique lit le titre
 * et le nom de l'acheteur, et choisit un des métiers du site (ou aucun). Quelques centimes pour des
 * centaines d'offres ; chaque offre n'est examinée qu'une fois (sector_checked_at).
 */
export async function classifyMissingSectors(
  db = createAdminClient(),
  { limit = 300, batch = 60, deadline = Date.now() + 120_000, client }: { limit?: number; batch?: number; deadline?: number; client?: Pick<Anthropic, "beta"> } = {},
) {
  if (!process.env.ANTHROPIC_API_KEY && !client) return { classified: 0, skipped: "Clé du service absente" };
  const { data: sectors } = await db.from("sectors").select("slug, label");
  if (!sectors?.length) return { classified: 0, skipped: "Aucun métier" };
  const { data: rows, error } = await db
    .from("opportunities")
    .select("id, title, external_buyer_name")
    .is("sector_slug", null)
    .is("sector_checked_at", null)
    .eq("status", "PUBLISHED")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!rows?.length) return { classified: 0, skipped: "Toutes les offres ont un métier ou ont été examinées" };
  const slugs = sectors.map((s) => s.slug) as [string, ...string[]];
  const Schema = z.object({ items: z.array(z.object({ n: z.number().int(), metier: z.enum([...slugs, NONE] as [string, ...string[]]) })) });
  const system = `Tu ranges des appels d'offres publics français dans le métier de l'entreprise qui fera le travail.
Métiers possibles (identifiant : libellé) :
${sectors.map((s) => `- ${s.slug} : ${s.label}`).join("\n")}
Règles : un seul métier par offre, celui de l'entreprise qui réalisera la prestation ou livrera la fourniture. Si aucun ne convient vraiment (médicaments, archéologie, actes juridiques…), réponds « ${NONE} ». Ne devine pas : dans le doute, « ${NONE} ».`;
  const ai = client ?? new Anthropic({ timeout: 60_000, maxRetries: 1 });
  let classified = 0;
  let none = 0;
  for (let i = 0; i < rows.length && Date.now() < deadline; i += batch) {
    const chunk = rows.slice(i, i + batch);
    try {
      const r = await ai.beta.messages.parse({
        model: REPORT_MODEL,
        max_tokens: 4000,
        output_config: { format: betaZodOutputFormat(Schema) },
        system,
        messages: [{ role: "user", content: chunk.map((o, n) => `${n}. ${o.title}${o.external_buyer_name ? ` (acheteur : ${o.external_buyer_name})` : ""}`).join("\n") }],
      });
      const picks = new Map((r.parsed_output?.items ?? []).map((x) => [x.n, x.metier]));
      for (const [n, o] of chunk.entries()) {
        const m = picks.get(n);
        if (m && m !== NONE && slugs.includes(m)) {
          await db.from("opportunities").update({ sector_slug: m, sector_checked_at: new Date().toISOString() }).eq("id", o.id).is("sector_slug", null);
          classified++;
        } else {
          await db.from("opportunities").update({ sector_checked_at: new Date().toISOString() }).eq("id", o.id);
          none++;
        }
      }
    } catch (e) {
      logServerError("classify sectors", e);
      break;
    }
  }
  return { classified, none };
}
