import { requireSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TestimonialForm } from "@/components/testimonials/testimonial-form";

export const metadata = { title: "Donner mon avis", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Avis d'un membre (lien de l'e-mail « Votre avis compte ») : un seul avis, modifiable avant publication. */
export default async function TestimonialPage() {
  const session = await requireSession("/avis");
  const { data: t } = await createAdminClient().from("testimonials").select("author_name, author_role, company_name, quote, rating, consent_publish, status").eq("user_id", session.userId).maybeSingle();
  return (
    <div className="container-page max-w-2xl py-10 sm:py-14">
      <h1 className="text-3xl font-extrabold text-navy">Votre avis sur LinkProB2B</h1>
      <p className="mt-3 text-slate-600">
        Deux minutes suffisent. Votre retour nous aide à améliorer le site. S&apos;il peut aider d&apos;autres entreprises à nous découvrir, vous pouvez accepter qu&apos;il soit
        affiché : il sera relu avant publication et vous pouvez demander son retrait à tout moment.
      </p>
      {t?.status === "APPROVED" && <p className="mt-4 rounded-xl bg-teal-50 p-4 text-sm text-teal-900">Votre avis est publié sur le site. Merci !</p>}
      <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <TestimonialForm
          initial={{
            authorName: t?.author_name ?? session.profile.full_name ?? "",
            authorRole: t?.author_role ?? session.profile.job_title ?? "",
            companyName: t?.company_name ?? session.activeCompany?.company.name ?? "",
            quote: t?.quote ?? "",
            rating: t?.rating ?? null,
            consent: t?.consent_publish ?? false,
          }}
        />
      </div>
    </div>
  );
}
