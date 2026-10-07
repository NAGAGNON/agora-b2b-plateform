import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHead, Panel } from "@/components/outreach/ui";
import { ProspectForm } from "@/components/outreach/prospect-forms";

export const metadata = { title: "Ajouter une entreprise" };

export default async function NewProspectPage() {
  const supabase = await createClient();
  const [{ data: sectors }, { data: departments }] = await Promise.all([
    supabase.from("sectors").select("slug, label").eq("is_active", true).order("sort_order"),
    supabase.from("departments").select("code, name").order("code"),
  ]);
  return (
    <>
      <Link href="/outreach/prospects" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-navy">
        <ArrowLeft className="size-4" aria-hidden /> Entreprises
      </Link>
      <PageHead title="Ajouter une entreprise" description="Uniquement des informations professionnelles réelles, d'origine identifiée." />
      <Panel title="Fiche entreprise">
        <ProspectForm sectors={sectors ?? []} departments={departments ?? []} />
      </Panel>
    </>
  );
}
