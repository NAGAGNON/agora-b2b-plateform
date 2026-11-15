import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TeamInvitePanel } from "@/components/dashboard/team-invite-panel";

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/**
 * Tableau de bord : « Votre équipe ». Propose (sans insister) d'ajouter des collègues avec leur poste,
 * pour préparer les candidatures à plusieurs. Les administrateurs invitent ; les membres voient l'équipe.
 */
export async function TeamCard({ companyId, isAdmin }: { companyId: string; isAdmin: boolean }) {
  const db = await createClient();
  const [{ data: members }, { data: invitations }] = await Promise.all([
    db.from("company_members").select("id, user:users(full_name, email, job_title)").eq("company_id", companyId).order("created_at").limit(12),
    isAdmin ? db.from("company_invitations").select("id, email, job_title").eq("company_id", companyId).is("accepted_at", null).limit(12) : Promise.resolve({ data: [] as { id: string; email: string; job_title: string | null }[] }),
  ]);
  const people = (members ?? []).map((m) => (Array.isArray(m.user) ? m.user[0] : m.user)).filter(Boolean);
  const pending = invitations ?? [];
  const alone = people.length <= 1 && pending.length === 0;
  // Un membre seul sans droit d'inviter : rien à proposer
  if (!isAdmin && alone) return null;

  return (
    <section className="plan-in relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-white to-sky p-6 shadow-sm ring-1 ring-slate-200 sm:p-7" data-testid="team-card">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-12 size-48 animate-aurora rounded-full bg-teal/15 blur-3xl" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wide text-teal-700 uppercase">Votre équipe</p>
          <h2 className="mt-1 font-heading text-xl font-bold text-navy">{alone ? "Préparez vos candidatures à plusieurs" : `${people.length} membre${people.length > 1 ? "s" : ""} dans votre équipe`}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {alone
              ? "Si vous le souhaitez, ajoutez un collègue avec son poste : il verra les mêmes candidatures, le planning et le journal de suivi."
              : "Chacun voit les candidatures, le planning et le journal de suivi de l'entreprise."}
          </p>
          <ul className="mt-4 flex flex-wrap items-center gap-2" aria-label="Membres de l'équipe">
            {people.map((u, i) => (
              <li key={i} className="flex items-center gap-2 rounded-full bg-white py-1 pr-3 pl-1 shadow-sm ring-1 ring-slate-200">
                <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-teal to-electric text-[11px] font-bold text-navy" aria-hidden>
                  {initials(u!.full_name || u!.email)}
                </span>
                <span className="text-sm font-medium text-navy">{(u!.full_name || u!.email).split(" ")[0]}</span>
                {u!.job_title && <span className="text-xs text-slate-500">· {u!.job_title}</span>}
              </li>
            ))}
            {pending.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-full border border-dashed border-teal/40 bg-white/60 py-1 pr-3 pl-1">
                <span className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500" aria-hidden>
                  {initials(p.email)}
                </span>
                <span className="text-sm text-slate-600">{p.email}</span>
                <span className="text-xs text-teal-700">invité{p.job_title ? ` · ${p.job_title}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 md:w-80">
          {isAdmin ? (
            <TeamInvitePanel />
          ) : (
            <p className="text-sm text-slate-500">Pour ajouter un collègue, demandez à un administrateur de votre entreprise.</p>
          )}
          <Link href="/dashboard/entreprise#equipe" className="text-center text-sm font-semibold text-teal-700 hover:underline">
            Gérer l&apos;équipe
          </Link>
        </div>
      </div>
    </section>
  );
}
