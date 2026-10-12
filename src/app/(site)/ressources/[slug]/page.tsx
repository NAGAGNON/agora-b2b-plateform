import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES } from "@/content/guides";
import { ContentPage } from "@/components/content-page";
import { ARTICLE_AUTHOR, pageMetadata } from "@/lib/seo";
import { JsonLd, articleLd, breadcrumbLd } from "@/components/json-ld";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata(props: PageProps<"/ressources/[slug]">) {
  const { slug } = await props.params;
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g) return { title: "Guide introuvable" };
  return pageMetadata({ title: g.title, description: g.description, path: `/ressources/${g.slug}` });
}

export default async function GuidePage(props: PageProps<"/ressources/[slug]">) {
  const { slug } = await props.params;
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g) notFound();
  return (
    <ContentPage title={g.title} intro={g.description}>
      <JsonLd
        data={[
          articleLd({ title: g.title, description: g.description, path: `/ressources/${g.slug}` }),
          breadcrumbLd([
            { name: "Ressources", path: "/ressources" },
            { name: g.title, path: `/ressources/${g.slug}` },
          ]),
        ]}
      />
      {g.sections.map((s) => (
        <section key={s.heading}>
          <h2>{s.heading}</h2>
          {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
          {s.bullets && (
            <ul>
              {s.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="mt-10 border-t border-slate-200 pt-4 text-sm text-slate-500">
        Rédigé par <strong className="text-navy">{ARTICLE_AUTHOR}</strong>
      </p>
      <p className="mt-6">
        <Link href="/ressources">← Toutes les ressources</Link>
      </p>
    </ContentPage>
  );
}
