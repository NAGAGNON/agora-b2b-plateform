import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const session = await requireSession("/dashboard/messages");
  const supabase = await createClient();
  const myIds = session.memberships.map((m) => m.company.id);
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, subject, last_message_at, opportunity_id, buyer:companies!conversations_buyer_company_id_fkey(id, name), supplier:companies!conversations_supplier_company_id_fkey(id, name), messages(id, body, read_at, sender_company_id, created_at)")
    .order("last_message_at", { ascending: false })
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" });
  const { data: unreadRows } = myIds.length
    ? await supabase.from("messages").select("conversation_id").is("read_at", null).not("sender_company_id", "in", `(${myIds.join(",")})`)
    : { data: [] };
  const unreadBy = new Map<string, number>();
  for (const r of unreadRows ?? []) unreadBy.set(r.conversation_id, (unreadBy.get(r.conversation_id) ?? 0) + 1);
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

  return (
    <div>
      <h1 className="text-2xl font-bold">Messages</h1>
      <p className="mt-1 mb-6 text-slate-600">
        Les conversations s&apos;ouvrent entre un demandeur et un fournisseur ayant manifesté son intérêt ou répondu à une opportunité.
      </p>
      {!convs?.length ? (
        <EmptyState
          icon={<MessageSquare className="size-6" aria-hidden />}
          title="Aucune conversation"
          description="Manifestez votre intérêt pour une opportunité, ou contactez un fournisseur depuis la gestion de vos consultations."
          action={<ButtonLink href="/opportunites">Explorer les opportunités</ButtonLink>}
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {convs.map((c) => {
            const buyer = one(c.buyer);
            const supplier = one(c.supplier);
            const other = buyer && myIds.includes(buyer.id) ? supplier : buyer;
            const last = c.messages?.[0];
            const unread = unreadBy.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <Link href={`/dashboard/messages/${c.id}`} className={cn("flex items-start gap-3 px-5 py-4 hover:bg-sky/60", unread && "bg-sky/40")}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={cn("truncate text-navy", unread ? "font-bold" : "font-semibold")}>{other?.name}</p>
                      <span className="shrink-0 text-xs text-slate-400">{relativeTime(c.last_message_at)}</span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{c.subject}</p>
                    {last && <p className="mt-1 truncate text-sm text-slate-600">{last.body}</p>}
                  </div>
                  {unread > 0 && <span className="mt-1 rounded-full bg-teal px-2 text-xs font-bold text-white">{unread}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
