import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProposalForm } from "@/components/opportunities/proposal-form";
import { Notice } from "@/components/ui/notice";
import { requireCompany } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PRIVATE_METADATA } from "@/lib/seo";
import { formatDateTime } from "@/lib/format";
import { DEMO_NOTICE } from "@/lib/constants";

export const metadata = { ...PRIVATE_METADATA, title: "Répondre à la consultation" };

export default async function RespondPage(props: PageProps<"/opportunites/[id]/repondre">) {
  const { id } = await props.params;
  const session = await requireCompany(`/opportunites/${id}/repondre`);
  const supabase = await createClient();
  const { data: o } = await supabase.from("opportunities").select("id, title, origin, status, company_id, response_deadline, is_demo").eq("id", id).maybeSingle();
  if (!o) notFound();
  if (o.origin === "EXTERNAL") redirect(`/opportunites/${id}`);
  const companyId = session.activeCompany.company.id;
  const { data: existing } = await supabase.from("proposals").select("*").eq("opportunity_id", id).eq("company_id", companyId).maybeSingle();
  const deadlinePassed = o.response_deadline && new Date(o.response_deadline) < new Date();
  const blocked =
    o.company_id === companyId
      ? "Vous ne pouvez pas répondre à un besoin publié par votre entreprise."
      : o.status !== "PUBLISHED" || deadlinePassed
        ? "Cette opportunité n'accepte plus de réponses."
        : existing && !["SUBMITTED", "INFO_REQUESTED", "WITHDRAWN"].includes(existing.status)
          ? "Votre réponse a déjà été traitée par le demandeur et ne peut plus être modifiée."
          : null;
  return (
    <div className="container-page max-w-3xl py-8 sm:py-12">
      <Link href={`/opportunites/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Retour à l&apos;opportunité
      </Link>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{existing ? "Modifier ma réponse" : "Répondre à la consultation"}</h1>
      <p className="mt-1 text-slate-600">{o.title}</p>
      <p className="mt-1 text-sm text-slate-500">
        Au nom de <strong>{session.activeCompany.company.name}</strong>
        {o.response_deadline ? ` · Date limite : ${formatDateTime(o.response_deadline)}` : ""}
      </p>
      {o.is_demo && (
        <Notice tone="warning" className="mt-4">
          {DEMO_NOTICE}
        </Notice>
      )}
      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        {blocked ? <Notice tone="warning">{blocked}</Notice> : <ProposalForm opportunityId={id} values={existing ?? undefined} />}
      </div>
    </div>
  );
}
