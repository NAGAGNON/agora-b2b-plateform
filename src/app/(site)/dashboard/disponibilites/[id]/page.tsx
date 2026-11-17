import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/lib/auth";
import { getServiceOffer } from "@/lib/queries/service-offers";
import { getDepartments, getSectors } from "@/lib/queries/platform";
import { ServiceOfferForm } from "@/components/service-offers/service-offer-form";
import { Notice } from "@/components/ui/notice";
import { isUuid } from "@/lib/format";

export const metadata = { title: "Modifier ma disponibilité" };

export default async function EditServiceOfferPage(props: PageProps<"/dashboard/disponibilites/[id]">) {
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const session = await requireCompany(`/dashboard/disponibilites/${id}`);
  const [o, sectors, departments] = await Promise.all([getServiceOffer(id), getSectors(), getDepartments()]);
  if (!o || o.company_id !== session.activeCompany.company.id) notFound();
  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard/disponibilites" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
        <ArrowLeft className="size-4" aria-hidden /> Mes disponibilités
      </Link>
      <h1 className="font-heading text-2xl font-extrabold text-navy sm:text-3xl">Modifier ma disponibilité</h1>
      {o.status === "REMOVED" ? (
        <Notice tone="error" title="Retirée par la modération">
          {o.removed_reason ?? "Cette disponibilité ne peut plus être modifiée."}
        </Notice>
      ) : (
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <ServiceOfferForm
            initial={{
              id: o.id,
              title: o.title,
              description: o.description,
              sector_slug: o.sector_slug,
              department_code: o.department_code,
              city: o.city,
              nationwide: o.nationwide,
              available_from: o.available_from,
              available_until: o.available_until,
              capacity: o.capacity,
            }}
            sectors={sectors}
            departments={departments}
          />
        </div>
      )}
    </div>
  );
}
