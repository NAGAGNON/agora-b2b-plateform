import Link from "next/link";
import { ExternalLink, Trophy } from "lucide-react";
import type { AwardItem } from "@/lib/queries/awards";
import { formatDate } from "@/lib/format";

/** Liste de marchés attribués : objet, acheteur, entreprises titulaires, date, lien vers l'avis officiel. */
export function AwardList({ awards, linkWinners = true, linkBuyer = true }: { awards: AwardItem[]; linkWinners?: boolean; linkBuyer?: boolean }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      {awards.map((a) => (
        <li key={a.idweb} className="p-4 sm:p-5">
          <p className="font-semibold text-navy [overflow-wrap:anywhere]">{a.title}</p>
          <p className="mt-1 text-sm text-slate-600">
            {a.buyer_name &&
              (linkBuyer && a.buyer_key ? (
                <Link href={`/acheteurs/${a.buyer_key}`} className="font-medium text-teal-800 hover:underline">
                  {a.buyer_name}
                </Link>
              ) : (
                <span>{a.buyer_name}</span>
              ))}
            {a.department_code ? ` · ${a.department_code}` : ""} · {formatDate(a.published_on)}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Trophy className="size-4 shrink-0 text-teal-700" aria-hidden />
            <span className="text-slate-500">Attribué à</span>
            {a.winners.map((w, i) => (
              <span key={a.winner_keys[i] ?? w}>
                {linkWinners && a.winner_keys[i] ? (
                  <Link href={`/titulaires/${a.winner_keys[i]}`} className="font-semibold text-navy hover:text-teal-700 hover:underline">
                    {w}
                  </Link>
                ) : (
                  <strong className="text-navy">{w}</strong>
                )}
                {i < a.winners.length - 1 ? "," : ""}
              </span>
            ))}
            {a.url && (
              <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-teal-700">
                Avis officiel <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
