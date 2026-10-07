import { notFound } from "next/navigation";
import { LandingPage, landingMetadata } from "@/components/opportunities/landing-page";
import { resolveLanding } from "@/lib/landing";

/** /opportunites/<région>/<département> et /opportunites/<région>/<secteur> */
export async function generateMetadata(props: PageProps<"/opportunites/[id]/[zone]">) {
  const { id, zone } = await props.params;
  const landing = await resolveLanding(id, zone);
  if (!landing) return { title: "Page introuvable" };
  return landingMetadata(landing, `/opportunites/${id}/${zone}`, await props.searchParams);
}

export default async function ZonePage(props: PageProps<"/opportunites/[id]/[zone]">) {
  const { id, zone } = await props.params;
  const landing = await resolveLanding(id, zone);
  if (!landing) notFound();
  return <LandingPage landing={landing} path={`/opportunites/${id}/${zone}`} sp={await props.searchParams} />;
}
