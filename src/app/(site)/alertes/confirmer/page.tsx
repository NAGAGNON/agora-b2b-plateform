import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { confirmLead, leadCriteriaLabel } from "@/lib/alert-leads";
import { getDepartments, getSectorLabels } from "@/lib/queries/platform";
import { regionByName } from "@/lib/geo";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PRIVATE_METADATA } from "@/lib/seo";

export const metadata = { ...PRIVATE_METADATA, title: "Confirmer mon alerte" };

/** Lien de confirmation (double opt-in) de l'alerte par e-mail sans compte. */
export default async function ConfirmLeadPage(props: PageProps<"/alertes/confirmer">) {
  const sp = await props.searchParams;
  const token = typeof sp.jeton === "string" ? sp.jeton : "";
  const lead = token ? await confirmLead(token) : null;
  if (!lead || lead.status !== "CONFIRMED") {
    return (
      <div className="container-page max-w-xl py-16">
        <h1 className="text-2xl font-bold">Lien invalide</h1>
        <Notice tone="error" className="mt-4">
          Ce lien de confirmation n&apos;est plus valide. Vous pouvez refaire la demande depuis n&apos;importe quelle fiche d&apos;opportunité.
        </Notice>
      </div>
    );
  }
  const [deps, labels] = await Promise.all([getDepartments(), getSectorLabels()]);
  const dep = deps.find((d) => d.code === lead.department_code);
  const region = dep ? regionByName(dep.region) : null;
  const listPath =
    dep && region && lead.sector_slug
      ? `/opportunites/${region.slug}/${dep.slug}/${lead.sector_slug}`
      : dep && region
        ? `/opportunites/${region.slug}/${dep.slug}`
        : lead.sector_slug
          ? `/opportunites/${lead.sector_slug}`
          : "/opportunites";
  return (
    <div className="container-page max-w-xl py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <CheckCircle2 className="size-10 text-teal-600" aria-hidden />
        <h1 className="mt-3 text-2xl font-bold">Votre alerte est active</h1>
        <p className="mt-3 text-slate-600">
          Vous recevrez chaque semaine les nouveaux marchés <strong>{leadCriteriaLabel({ sector: lead.sector_slug, department: lead.department_code, region: lead.region }, dep?.name, labels)}</strong>.
        </p>
        <div className="mt-6 rounded-xl bg-sky p-5">
          <p className="font-semibold text-navy">Allez plus loin, gratuitement</p>
          <p className="mt-1 text-sm text-slate-700">
            Avec un compte : alertes sur mesure chaque jour, publication de vos besoins, contact direct avec les entreprises et suivi de vos affaires.
          </p>
          <ButtonLink href={`/inscription?email=${encodeURIComponent(lead.email)}`} className="mt-4">
            Créer mon compte gratuit
          </ButtonLink>
        </div>
        <p className="mt-6 text-sm">
          <Link href={listPath} className="font-semibold text-teal-700 underline">
            Voir dès maintenant les marchés ouverts
          </Link>
        </p>
      </div>
    </div>
  );
}
