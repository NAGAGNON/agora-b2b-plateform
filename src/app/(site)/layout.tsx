import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DemoBanner } from "@/components/demo";
import { hasDemoData } from "@/lib/queries/platform";
import { AudienceTracker } from "@/components/audience";
import { JsonLd, organizationLd } from "@/components/json-ld";
import { GuidedAssistant } from "@/components/assistant/guided-assistant";
import { ApplicationPromptCard } from "@/components/applications/application-prompt";
import { getSession } from "@/lib/auth";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [demo, session] = await Promise.all([hasDemoData(), getSession()]);
  return (
    <>
      {demo && <DemoBanner />}
      <Header />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <Footer />
      <AudienceTracker />
      <GuidedAssistant />
      {session?.activeCompany && <ApplicationPromptCard />}
      <JsonLd data={organizationLd()} />
    </>
  );
}
