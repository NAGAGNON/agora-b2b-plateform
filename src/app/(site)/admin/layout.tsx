import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/queries/platform";
import { PLATFORM_ROLE_LABELS } from "@/lib/constants";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata = { ...PRIVATE_METADATA, title: { default: "Administration", template: "%s | Administration LinkProB2B" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  const settings = await getSettings();
  if (settings.security?.admin_mfa_required === true && session.mfaLevel !== "aal2") {
    redirect("/dashboard/parametres?mfa=requis");
  }
  const supabase = await createClient();
  const [{ count: pending }, { count: reports }] = await Promise.all([
    supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("status", "PENDING_REVIEW"),
    supabase.from("reports").select("id", { count: "exact", head: true }).in("status", ["OPEN", "REVIEWING"]),
  ]);
  return (
    <div className="container-page py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-navy px-4 py-3 text-white">
        <p className="flex items-center gap-2 font-semibold">
          <Shield className="size-5 text-teal" aria-hidden /> Administration LinkProB2B
        </p>
        <p className="text-sm text-slate-300">
          {session.profile.full_name} · {PLATFORM_ROLE_LABELS[session.profile.platform_role]}
          {session.mfaLevel === "aal2" ? " · 2FA ✓" : ""}
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <AdminNav isAdmin={session.isAdmin} pending={pending ?? 0} reports={reports ?? 0} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
