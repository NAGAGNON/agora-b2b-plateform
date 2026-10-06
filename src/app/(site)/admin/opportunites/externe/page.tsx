import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDepartments, getSectors } from "@/lib/queries/platform";
import { Notice } from "@/components/ui/notice";
import { ExternalOpportunityForm } from "@/components/admin/external-form";

export const metadata = { title: "Référencer une opportunité externe" };

export default async function ExternalOpportunityPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: sources }, departments] = await Promise.all([
    supabase.from("external_sources").select("id, name").eq("status", "APPROVED").order("name"),
    getDepartments(),
  ]);
  return (
    <div className="max-w-3xl">
      <Link href="/admin/opportunites" className="text-sm font-semibold text-teal-700 hover:underline">
        ← Opportunités
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Référencer une opportunité externe</h1>
      <Notice tone="warning" className="my-6" title="Règles de référencement">
        Uniquement depuis une source approuvée après validation juridique de ses conditions de réutilisation. L&apos;opportunité sera toujours affichée comme
        externe, avec la source, la référence, les dates et un lien vers l&apos;annonce originale. Aucun scraping automatisé.
      </Notice>
      {!sources?.length ? (
        <Notice tone="info">
          Aucune source approuvée.{" "}
          <Link href="/admin/sources" className="font-semibold underline">
            Gérer les sources
          </Link>
        </Notice>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <ExternalOpportunityForm sources={sources} departments={departments} sectors={await getSectors()} />
        </div>
      )}
    </div>
  );
}
