import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowUpRight, FlaskConical, Send } from "lucide-react";
import { OutreachNav } from "@/components/outreach/nav";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/queries/platform";
import { createClient } from "@/lib/supabase/server";
import { PRIVATE_METADATA, siteUrl } from "@/lib/seo";

export const metadata = { ...PRIVATE_METADATA, title: { default: "LinkProB2B Outreach", template: "%s | LinkProB2B Outreach" } };

/**
 * LinkProB2B Outreach : application de prospection séparée du site public
 * (outreach.linkprob2b.com), réservée aux administrateurs de la plateforme.
 */
export default async function OutreachLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const settings = await getSettings();
  if (settings.security?.admin_mfa_required === true && session.mfaLevel !== "aal2") redirect("/dashboard/parametres?mfa=requis");
  const supabase = await createClient();
  const { data: s } = await supabase.from("outreach_settings").select("dry_run").eq("id", true).maybeSingle();
  const dryRun = s?.dry_run !== false || process.env.OUTREACH_SEND_ENABLED !== "true";
  return (
    <div className="min-h-dvh bg-slate-50 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="bg-navy px-4 py-4 text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:py-6">
        <div className="mb-4 flex items-center justify-between gap-3 lg:mb-8 lg:block">
          <Link href="/outreach" className="block">
            <Image src="/brand/logo-white.png" alt="LinkProB2B" width={150} height={30} className="h-auto w-[140px]" priority />
            <span className="mt-1 block text-xs font-bold tracking-[0.2em] text-teal uppercase">Outreach</span>
          </Link>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold lg:mt-4 ${dryRun ? "bg-violet-500/20 text-violet-100" : "bg-teal/20 text-teal-100"}`}>
            {dryRun ? <FlaskConical className="size-3.5" aria-hidden /> : <Send className="size-3.5" aria-hidden />}
            {dryRun ? "Mode simulation" : "Envoi réel actif"}
          </span>
        </div>
        <OutreachNav />
        <div className="mt-auto hidden space-y-2 border-t border-white/10 pt-4 text-xs text-slate-400 lg:block">
          <a href={siteUrl()} className="flex items-center gap-1 hover:text-white">
            Site LinkProB2B <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
          <Link href="/admin" className="flex items-center gap-1 hover:text-white">
            Administration <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
          <p className="truncate">{session.email}</p>
        </div>
      </aside>
      <main id="contenu" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}
