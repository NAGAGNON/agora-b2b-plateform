import Link from "next/link";
import { notFound } from "next/navigation";
import { PublishWizard } from "@/components/opportunities/publish-wizard";
import { Notice } from "@/components/ui/notice";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDepartments, getPlaces, getSectors } from "@/lib/queries/platform";

export const metadata = { title: "Modifier une publication" };

export default async function EditOpportunityPage(props: PageProps<"/dashboard/opportunites/[id]/modifier">) {
  const { id } = await props.params;
  const session = await requireCompany(`/dashboard/opportunites/${id}/modifier`);
  const supabase = await createClient();
  const { data: o } = await supabase.from("opportunities").select("*, documents:opportunity_documents(id, file_name)").eq("id", id).maybeSingle();
  if (!o || !session.memberships.some((m) => m.company.id === o.company_id)) notFound();
  const [places, departments] = await Promise.all([getPlaces(), getDepartments()]);
  const editable = ["DRAFT", "CHANGES_REQUESTED", "REJECTED", "PUBLISHED", "PENDING_REVIEW"].includes(o.status);
  return (
    <div>
      <Link href={`/dashboard/opportunites/${id}`} className="text-sm font-semibold text-teal-700 hover:underline">
        ← Retour à la consultation
      </Link>
      <h1 className="mt-3 mb-6 text-2xl font-bold">Modifier la publication</h1>
      {!editable ? (
        <Notice tone="warning">Cette opportunité ne peut plus être modifiée (statut : {o.status}).</Notice>
      ) : (
        <>
          {o.status === "PUBLISHED" && (
            <Notice tone="info" className="mb-6">
              Cette opportunité est publiée : une modification du titre, de la description, du résumé ou du budget la renverra en validation avant
              republication.
            </Notice>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <PublishWizard values={o} places={places} departments={departments} sectors={await getSectors()} companyName={session.activeCompany.company.name} existingDocuments={o.documents} />
          </div>
        </>
      )}
    </div>
  );
}
