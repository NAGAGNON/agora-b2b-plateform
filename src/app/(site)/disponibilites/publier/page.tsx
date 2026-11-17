import Link from "next/link";
import { CalendarCheck2, MessageSquare, Megaphone } from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDepartments, getSectors } from "@/lib/queries/platform";
import { ServiceOfferForm, type ServiceOfferValues } from "@/components/service-offers/service-offer-form";
import { Notice } from "@/components/ui/notice";
import { pageMetadata } from "@/lib/seo";
import { isUuid } from "@/lib/format";

export const metadata = pageMetadata({
  title: "Annoncer une disponibilité",
  description: "Dites ce que votre entreprise peut faire, où et quand : les entreprises qui cherchent un prestataire vous écrivent.",
  path: "/disponibilites/publier",
  noindex: true,
});

/** Reprise d'un besoin publié par erreur (l'entreprise y présentait ses services) : textes repris tels quels. */
async function fromNeed(id: string | undefined, companyId: string): Promise<ServiceOfferValues | undefined> {
  if (!id || !isUuid(id)) return undefined;
  const supabase = await createClient();
  const { data: o } = await supabase.from("opportunities").select("id, title, description, sector_slug, department_code, city, company_id, origin").eq("id", id).maybeSingle();
  if (!o || o.company_id !== companyId || o.origin !== "INTERNAL") return undefined;
  return {
    title: o.title.slice(0, 140),
    description: (o.description ?? "").slice(0, 3000),
    sector_slug: o.sector_slug,
    department_code: o.department_code,
    city: o.city,
    from_opportunity_id: o.id,
  };
}

export default async function PublishServiceOfferPage(props: PageProps<"/disponibilites/publier">) {
  const session = await requireCompany("/disponibilites/publier");
  const sp = await props.searchParams;
  const [sectors, departments, initial] = await Promise.all([getSectors(), getDepartments(), fromNeed(typeof sp.depuis === "string" ? sp.depuis : undefined, session.activeCompany.company.id)]);
  const suspended = session.activeCompany.company.status !== "ACTIVE";
  return (
    <div className="container-page max-w-4xl py-8 sm:py-12">
      <p className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold tracking-wide text-teal-800 uppercase ring-1 ring-teal/30">
        <Megaphone className="size-3.5" aria-hidden /> Disponibilité
      </p>
      <h1 className="mt-3 font-heading text-2xl font-extrabold text-navy sm:text-4xl">Annoncez ce que vous pouvez faire</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Au nom de <strong className="text-navy">{session.activeCompany.company.name}</strong>. Les entreprises qui cherchent un prestataire dans votre métier et votre zone vous trouvent, puis vous écrivent.
      </p>
      <ul className="mt-5 flex flex-wrap gap-2 text-sm">
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-slate-700 ring-1 ring-slate-200">
          <CalendarCheck2 className="size-4 text-teal-700" aria-hidden /> En ligne tout de suite, gratuitement
        </li>
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-slate-700 ring-1 ring-slate-200">
          <MessageSquare className="size-4 text-teal-700" aria-hidden /> Contacts par la messagerie, prévenu par e-mail
        </li>
      </ul>
      {initial && (
        <Notice tone="info" className="mt-6" title="Repris de votre besoin">
          Votre texte est repris : relisez-le et ajustez-le pour qu&apos;il présente ce que vous proposez. Votre besoin d&apos;origine n&apos;est pas modifié.
        </Notice>
      )}
      <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
        {suspended ? (
          <Notice tone="error">Votre entreprise est suspendue : la publication est désactivée. Contactez l&apos;équipe LinkProB2B.</Notice>
        ) : (
          <ServiceOfferForm initial={initial} sectors={sectors} departments={departments} />
        )}
      </div>
      <p className="mt-6 text-sm text-slate-500">
        Vous cherchez plutôt un prestataire ?{" "}
        <Link href="/publier" className="font-semibold text-teal-700 underline">
          Publier un besoin
        </Link>
      </p>
    </div>
  );
}
