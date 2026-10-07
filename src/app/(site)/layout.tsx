import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DemoBanner } from "@/components/demo";
import { hasDemoData } from "@/lib/queries/platform";
import { AudienceTracker } from "@/components/audience";
import { JsonLd, organizationLd } from "@/components/json-ld";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const demo = await hasDemoData();
  return (
    <>
      {demo && <DemoBanner />}
      <Header />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <Footer />
      <AudienceTracker />
      <JsonLd data={organizationLd()} />
    </>
  );
}
