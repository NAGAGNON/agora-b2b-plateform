import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui/notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { ArticleRowActions, ArticleSettingsForm, GenerateArticleButton } from "@/components/admin/article-controls";

export const metadata = { title: "Articles" };
// La rédaction manuelle (action serveur) peut prendre jusqu'à une minute.
export const maxDuration = 120;

export default async function AdminArticlesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: articles }, { data: setting }] = await Promise.all([
    supabase.from("articles").select("id, slug, title, status, topic_key, validation_note, model, created_at, published_at").order("created_at", { ascending: false }).limit(200),
    supabase.from("platform_settings").select("value").eq("key", "seo").maybeSingle(),
  ]);
  const s = (setting?.value ?? {}) as { articles_enabled?: boolean; articles_auto_publish?: boolean; articles_per_day?: number };
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const published = (articles ?? []).filter((a) => a.status === "PUBLISHED").length;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Articles (analyses de marché)</h1>
        <p className="mt-1 text-slate-600">
          Rédigés chaque jour par une IA à partir des seules opportunités réellement publiées, puis contrôlés : chaque chiffre doit figurer dans les données
          transmises. {published} article(s) en ligne sur <Link href="/analyses">/analyses</Link>.
        </p>
      </div>
      {!hasKey && (
        <Notice tone="warning" title="Rédaction inactive">
          Ajoutez la variable <code>ANTHROPIC_API_KEY</code> dans Vercel (Settings → Environment Variables, environnement Production), puis redéployez.
        </Notice>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Réglages" />
          <div className="p-5">
            <ArticleSettingsForm enabled={s.articles_enabled !== false} autoPublish={s.articles_auto_publish !== false} perDay={s.articles_per_day ?? 1} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Rédaction manuelle" description="Crée un brouillon sur le prochain thème disponible (secteur ou département ayant au moins 5 opportunités ouvertes)." />
          <div className="p-5">
            <GenerateArticleButton enabled={hasKey} />
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title={`Articles (${articles?.length ?? 0})`} />
        <ul className="divide-y divide-slate-100">
          {(articles ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.status === "PUBLISHED" ? "teal" : "slate"}>{a.status === "PUBLISHED" ? "Publié" : "Brouillon"}</Badge>
                  <span className="text-xs text-slate-500">{a.topic_key}</span>
                </div>
                <Link href={`/analyses/${a.slug}`} className="font-semibold text-navy hover:underline">
                  {a.title}
                </Link>
                <p className="text-xs text-slate-500">
                  Créé le {formatDateTime(a.created_at)}
                  {a.published_at && ` · publié le ${formatDateTime(a.published_at)}`}
                  {a.model && ` · ${a.model}`}
                </p>
                {a.validation_note && <p className="text-sm text-amber-800">À vérifier : {a.validation_note}</p>}
              </div>
              <ArticleRowActions id={a.id} status={a.status} />
            </li>
          ))}
          {(articles ?? []).length === 0 && <li className="p-5 text-sm text-slate-600">Aucun article pour le moment.</li>}
        </ul>
      </Card>
    </div>
  );
}
