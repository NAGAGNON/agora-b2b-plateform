import Link from "next/link";
import { notFound } from "next/navigation";
import { Paperclip } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MessageComposer } from "@/components/dashboard/message-composer";
import { ReportButton } from "@/components/report-button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { env } from "@/lib/env";
import { RealtimeRefresh, ScrollToEnd } from "@/components/realtime";

export const metadata = { title: "Conversation" };

export default async function ConversationPage(props: PageProps<"/dashboard/messages/[id]">) {
  const { id } = await props.params;
  const session = await requireSession(`/dashboard/messages/${id}`);
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, subject, opportunity_id, buyer_company_id, supplier_company_id, buyer:companies!conversations_buyer_company_id_fkey(name, slug), supplier:companies!conversations_supplier_company_id_fkey(name, slug)")
    .eq("id", id)
    .maybeSingle();
  if (!conv) notFound();
  await supabase.rpc("mark_conversation_read", { p_conversation_id: id });
  const { data: messages } = await supabase.from("messages").select("*").eq("conversation_id", id).order("created_at");
  const myIds = session.memberships.map((m) => m.company.id);
  const iAmBuyer = myIds.includes(conv.buyer_company_id);
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const other = iAmBuyer ? one(conv.supplier) : one(conv.buyer);
  const names: Record<string, string> = { [conv.buyer_company_id]: one(conv.buyer)?.name ?? "", [conv.supplier_company_id]: one(conv.supplier)?.name ?? "" };

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/dashboard/messages" className="text-xs font-semibold text-teal-700 hover:underline">
            ← Toutes les conversations
          </Link>
          <RealtimeRefresh
            config={env.realtime}
            channel={`conversation:${conv.id}`}
            indicator
            watch={[
              { table: "messages", event: "INSERT", filter: `conversation_id=eq.${conv.id}` },
              { table: "messages", event: "UPDATE", filter: `conversation_id=eq.${conv.id}` },
            ]}
          />
        </div>
        <h1 className="mt-1 text-lg font-bold">
          <Link href={`/entreprises/${other?.slug}`} className="hover:underline">
            {other?.name}
          </Link>
        </h1>
        {conv.opportunity_id && (
          <p className="truncate text-sm text-slate-500">
            À propos de :{" "}
            <Link href={iAmBuyer ? `/dashboard/opportunites/${conv.opportunity_id}` : `/opportunites/${conv.opportunity_id}`} className="text-teal-700 hover:underline">
              {conv.subject}
            </Link>
          </p>
        )}
      </header>
      <ol id="conversation-messages" className="flex-1 space-y-3 overflow-y-auto p-4" aria-label="Messages" aria-live="polite">
        {(messages ?? []).map((m) => {
          const mine = myIds.includes(m.sender_company_id);
          return (
            <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm sm:max-w-[70%]", mine ? "bg-navy text-white" : "bg-white text-slate-800")}>
                <p className={cn("text-xs font-semibold", mine ? "text-teal-50" : "text-teal-700")}>{names[m.sender_company_id]}</p>
                <p className="mt-0.5 text-sm whitespace-pre-line">{m.body}</p>
                {m.attachment_path && (
                  <a href={`/api/fichiers/message/${m.id}`} className={cn("mt-2 inline-flex items-center gap-1 text-xs underline", mine ? "text-white" : "text-navy")}>
                    <Paperclip className="size-3" aria-hidden /> {m.attachment_name ?? "Pièce jointe"}
                  </a>
                )}
                <p className={cn("mt-1 flex items-center justify-end gap-2 text-[11px]", mine ? "text-slate-300" : "text-slate-400")}>
                  <time dateTime={m.created_at}>{formatDateTime(m.created_at)}</time>
                  {mine && <span>{m.read_at ? "· Lu" : "· Envoyé"}</span>}
                </p>
                {!mine && (
                  <div className="text-right">
                    <ReportButton targetType="MESSAGE" targetId={m.id} signedIn label="" />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <ScrollToEnd count={messages?.length ?? 0} targetId="conversation-messages" />
      <MessageComposer conversationId={conv.id} />
    </div>
  );
}
