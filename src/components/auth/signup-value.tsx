import Image from "next/image";
import { Bell, FileText, Sparkles } from "lucide-react";
import { getPlatformStats } from "@/lib/queries/platform";

const nf = new Intl.NumberFormat("fr-FR");

/** Encart d'accueil de l'inscription : photo, chiffre réel du jour et trois bénéfices en pastilles. */
export async function SignupValue() {
  const stats = await getPlatformStats();
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="signup-value">
      <div className="relative h-28 sm:h-32">
        <Image src="/images/illustrations/poignee-de-main.webp" alt="" fill unoptimized sizes="(min-width: 640px) 28rem, 100vw" className="object-cover" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-navy-900/90 via-navy-900/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-5 text-white">
          {stats?.active ? (
            <>
              <p className="font-heading text-3xl leading-none font-bold">{nf.format(stats.active)}</p>
              <p className="mt-1 text-sm text-slate-100">opportunités ouvertes en ce moment{stats.new_24h ? `, dont ${nf.format(stats.new_24h)} nouvelles en 24 h` : ""}</p>
            </>
          ) : (
            <p className="font-heading text-xl font-bold">Les opportunités B2B de toute la France</p>
          )}
        </div>
      </div>
      <ul className="flex flex-wrap gap-2 px-4 py-3 text-xs font-medium text-slate-700">
        {[
          { icon: FileText, label: "Détail et documents" },
          { icon: Bell, label: "Alertes par e-mail" },
          { icon: Sparkles, label: "Gratuit, en 1 minute" },
        ].map(({ icon: Icon, label }) => (
          <li key={label} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
            <Icon className="size-3.5 text-teal-700" aria-hidden /> {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
