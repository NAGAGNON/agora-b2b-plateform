import { Mail, ShieldCheck, Flag } from "lucide-react";
import { ContactForm } from "@/components/public-forms";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact",
  description: "Contactez l'équipe LinkProB2B : rejoindre le pilote, question, signalement, données personnelles.",
  path: "/contact",
});

const SUBJECTS: Record<string, string> = {
  signalement: "Signalement d'un contenu",
  compte: "Question sur la plateforme",
  pilote: "Rejoindre le pilote",
  rgpd: "Données personnelles (RGPD)",
};

export default async function ContactPage(props: PageProps<"/contact">) {
  const sp = await props.searchParams;
  const subject = typeof sp.objet === "string" ? SUBJECTS[sp.objet] : undefined;
  const reference = typeof sp.ref === "string" && /^[0-9a-f-]{36}$/.test(sp.ref) ? sp.ref : undefined;
  return (
    <div className="container-page grid gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_22rem]">
      <div>
        <h1 className="text-3xl font-bold">Contact</h1>
        <p className="mt-2 mb-8 text-slate-600">Une question, une demande de retrait, un partenariat ? Écrivez-nous.</p>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <ContactForm defaultSubject={subject} reference={reference} />
        </div>
      </div>
      <aside className="space-y-4 text-sm text-slate-600">
        <div className="rounded-2xl bg-sky p-5">
          <p className="flex items-center gap-2 font-semibold text-navy">
            <Flag className="size-4" aria-hidden /> Signaler un contenu
          </p>
          <p className="mt-1">Chaque fiche dispose d&apos;un bouton « Signaler ». Vous pouvez aussi utiliser ce formulaire (objet : signalement).</p>
        </div>
        <div className="rounded-2xl bg-sky p-5">
          <p className="flex items-center gap-2 font-semibold text-navy">
            <ShieldCheck className="size-4" aria-hidden /> Vos données
          </p>
          <p className="mt-1">Export et suppression de compte sont disponibles directement dans votre espace, rubrique Paramètres.</p>
        </div>
        <div className="rounded-2xl bg-sky p-5">
          <p className="flex items-center gap-2 font-semibold text-navy">
            <Mail className="size-4" aria-hidden /> Délai de réponse
          </p>
          <p className="mt-1">Pendant le pilote, nous répondons généralement sous quelques jours ouvrés.</p>
        </div>
      </aside>
    </div>
  );
}
