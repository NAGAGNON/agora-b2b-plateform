import { notFound } from "next/navigation";
import { LandingPage, landingMetadata } from "@/components/opportunities/landing-page";
import { resolveLanding } from "@/lib/landing";

/** /opportunites/<région>/<département>/<secteur> : métier × département (« appels d'offres menuiserie Finistère »). */
export async function generateMetadata(props: PageProps<"/opportunites/[id]/[zone]/[sector]">) {
  const { id, zone, sector } = await props.params;
  const landing = await resolveLanding(id, zone, sector);
  if (!landing) return { title: "Page introuvable" };
  return landingMetadata(landing, `/opportunites/${id}/${zone}/${sector}`, await props.searchParams);
}

export default async function DepartmentSectorPage(props: PageProps<"/opportunites/[id]/[zone]/[sector]">) {
  const { id, zone, sector } = await props.params;
  const landing = await resolveLanding(id, zone, sector);
  if (!landing) notFound();
  return <LandingPage landing={landing} path={`/opportunites/${id}/${zone}/${sector}`} sp={await props.searchParams} />;
}
