import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyBoardDecisionToken } from "@/lib/board-token";
import { AUTHOR_LABEL, STATUS } from "@/lib/board-core";
import { EmailDecisionForm } from "@/components/board/email-decision-form";

export const metadata: Metadata = { title: "Décision du comité", robots: { index: false, follow: false } };

const VERB = { VALIDEE: "valider", REFUSEE: "refuser", PLUS_INFO: "demander plus d'infos" } as const;

/** Page de confirmation ouverte depuis l'e-mail du comité : rien n'est enregistré avant le clic. */
export default async function BoardDecisionPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const t = verifyBoardDecisionToken(token);
  const d = t ? (await createAdminClient().from("board_decisions").select("proposer, problem, decision, justification, expected, budget_eur, risks, urgency, critique, critic, critic_opinion, ceo_reason, status, founder_comment").eq("id", t.decisionId).maybeSingle()).data : null;
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <p className="text-xs font-bold tracking-wider text-violet-700 uppercase">Comité de direction</p>
      {!t || !d ? (
        <>
          <h1 className="mt-2 font-heading text-2xl font-bold text-navy">Lien expiré ou invalide</h1>
          <p className="mt-2 text-slate-600">Répondez depuis l&apos;administration.</p>
          <Link href="/admin/comite" className="mt-6 inline-flex rounded-xl bg-navy px-5 py-3 font-semibold text-white">Ouvrir le comité</Link>
        </>
      ) : (
        <>
          <h1 className="mt-2 font-heading text-2xl font-bold text-navy sm:text-3xl">{d.decision}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Proposée par {AUTHOR_LABEL[d.proposer] ?? d.proposer} · urgence {d.urgency}
            {d.budget_eur ? ` · budget ${d.budget_eur} €` : ""} · statut : {STATUS[d.status]?.label ?? d.status}
          </p>
          <dl className="mt-6 space-y-4 rounded-2xl bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
            {[
              ["Problème", d.problem],
              ["Justification", d.justification],
              ["Effet attendu", d.expected],
              ["Risques", d.risks],
              [`Contradicteur${d.critic ? ` (${d.critic}, ${d.critic_opinion})` : ""}`, d.critique],
              ["Le CEO", d.ceo_reason],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="font-semibold text-navy">{k}</dt>
                  <dd className="mt-0.5 text-slate-700">{v}</dd>
                </div>
              ))}
          </dl>
          <div className="mt-6">
            {["A_VALIDER", "PLUS_INFO", "REFUSEE_CEO", "PROPOSEE"].includes(d.status) ? (
              <EmailDecisionForm token={token} label={VERB[t.verdict]} />
            ) : (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                Vous avez déjà répondu à cette décision ({STATUS[d.status]?.label ?? d.status}).{d.founder_comment ? ` Votre commentaire : « ${d.founder_comment} »` : ""}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
