"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffActionSession } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { generateArticles } from "@/lib/articles";
import { parseForm, type ActionResult } from "@/lib/validation";

async function adminOnly() {
  const session = await getStaffActionSession();
  if (!session?.isAdmin) throw new Error("Accès refusé");
  return session;
}

function refresh(slug?: string) {
  revalidatePath("/admin/articles");
  revalidatePath("/analyses");
  if (slug) revalidatePath(`/analyses/${slug}`);
}

const idSchema = z.object({ id: z.uuid(), action: z.enum(["publish", "unpublish", "delete"]) });

export async function articleAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(idSchema, fd);
  if (!parsed.success) return parsed.result;
  const session = await adminOnly();
  const db = createAdminClient();
  const { data: a } = await db.from("articles").select("slug, published_at").eq("id", parsed.data.id).maybeSingle();
  if (!a) return { ok: false, error: "Article introuvable." };
  const { action } = parsed.data;
  const { error } =
    action === "delete"
      ? await db.from("articles").delete().eq("id", parsed.data.id)
      : await db
          .from("articles")
          .update(
            action === "publish"
              ? { status: "PUBLISHED", published_at: a.published_at ?? new Date().toISOString(), updated_at: new Date().toISOString() }
              : { status: "DRAFT", updated_at: new Date().toISOString() },
          )
          .eq("id", parsed.data.id);
  if (error) return { ok: false, error: userMessage(error) };
  await db.from("audit_logs").insert({ actor_user_id: session.userId, action: `article.${action}`, entity_type: "article", entity_id: parsed.data.id, metadata: { slug: a.slug } });
  refresh(a.slug);
  return { ok: true, message: action === "publish" ? "Article publié." : action === "unpublish" ? "Article repassé en brouillon." : "Article supprimé." };
}

const settingsSchema = z.object({
  enabled: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  autoPublish: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  perDay: z.coerce.number().int().min(1).max(3),
});

export async function updateArticleSettings(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(settingsSchema, fd);
  if (!parsed.success) return parsed.result;
  await adminOnly();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_setting", {
    p_key: "seo",
    p_value: { articles_enabled: parsed.data.enabled, articles_auto_publish: parsed.data.autoPublish, articles_per_day: parsed.data.perDay },
  });
  if (error) return { ok: false, error: userMessage(error) };
  revalidatePath("/admin/articles");
  return { ok: true, message: "Réglages enregistrés." };
}

export async function generateArticleNow(): Promise<ActionResult> {
  await adminOnly();
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Renseignez ANTHROPIC_API_KEY dans Vercel pour activer la rédaction." };
  if (!(await rateLimit("article-generate", 5, 3600))) return { ok: false, error: "5 générations manuelles par heure au maximum." };
  const r = await generateArticles(1, { autoPublish: false });
  if ("skipped" in r) return { ok: false, error: `Génération ignorée : ${r.skipped}.` };
  const first = r.generated[0];
  refresh(first?.slug);
  if (!first) return { ok: false, error: "Aucun thème disponible : chaque secteur et département ayant au moins 5 opportunités ouvertes a déjà son analyse ce mois-ci." };
  if (first.status === "ERROR") return { ok: false, error: `Échec : ${first.note}` };
  return { ok: true, message: `Brouillon créé : ${first.topic}${first.note ? ` (${first.note})` : ""}. Relisez-le puis publiez-le.` };
}
