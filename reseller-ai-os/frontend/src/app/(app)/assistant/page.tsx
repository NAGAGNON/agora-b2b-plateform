"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, Wrench } from "lucide-react";
import { api, useApi } from "@/lib/api";
import { Badge, Button, Card, ErrorBox, PageHeader, Spinner, cn, useToast } from "@/components/ui";

type Msg = { id?: number; role: "user" | "assistant"; text: string; tools?: { tool: string; is_action: boolean; args: Record<string, unknown> }[] };
type Conv = { id: number; title: string };
const TOOL_LABEL: Record<string, string> = { get_dashboard: "Lecture du tableau de bord", get_finance: "Lecture des finances", search_opportunities: "Recherche d'opportunités", list_purchase_orders: "Lecture des commandes", list_sales: "Lecture des ventes", list_inventory: "Lecture du stock",
  sync_sources: "Synchronisation des sources", analyze_opportunities: "Analyse des opportunités", prepare_purchase_baskets: "Préparation de paniers (à valider)", prepare_listings: "Préparation d'annonces", products_to_promote: "Produits à remettre en avant" };
const EXAMPLES = ["Recherche de nouvelles opportunités", "Trouve les produits avec une marge supérieure à 30 %", "Analyse les meilleures opportunités de la journée", "Prépare les achats de mes cinq meilleurs produits", "Affiche les commandes en attente",
  "Combien ai-je dépensé cette semaine ?", "Quel est mon bénéfice net ce mois-ci ?", "Quels produits dois-je remettre en avant ?", "Prépare les annonces des articles reçus aujourd'hui"];

export default function Page() {
  const convs = useApi<Conv[]>("/chat/conversations");
  const [cid, setCid] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const toast = useToast();
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  async function open(id: number) {
    try { const c = await api<{ messages: Msg[] }>(`/chat/conversations/${id}`); setCid(id); setMsgs(c.messages); setErr(null); } catch (e) { toast.err((e as Error).message); }
  }
  async function send(t: string) {
    if (!t.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text: t }]); setText(""); setBusy(true); setErr(null);
    try {
      const r = await api<{ conversation_id: number; reply: string; actions: { tool: string; is_action: boolean; args: Record<string, unknown>; error: boolean }[] }>("/chat", { body: { message: t, conversation_id: cid } });
      setCid(r.conversation_id);
      setMsgs((m) => [...m, { role: "assistant", text: r.reply, tools: r.actions }]);
      convs.reload();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-2">
        <Button className="w-full" variant="secondary" onClick={() => { setCid(null); setMsgs([]); setErr(null); }}>Nouvelle conversation</Button>
        <div className="space-y-1">{convs.data?.map((c) => <button key={c.id} onClick={() => open(c.id)} className={cn("block w-full truncate rounded-lg px-3 py-2 text-left text-sm hover:bg-surface2", cid === c.id && "bg-accentsoft text-accent")}>{c.title}</button>)}</div>
      </aside>
      <div className="flex min-h-[70vh] flex-col">
        <PageHeader title="Centre de contrôle IA" sub="Pilotez l'application en langage naturel. Claude lit vos données réelles et ne peut lancer que des actions autorisées et réversibles : il ne valide ni ne paie jamais un achat. Chaque action est journalisée." />
        <Card className="flex flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
            {msgs.length === 0 && (
              <div className="grid place-items-center gap-4 py-10 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-accentsoft text-accent"><Bot className="size-6" /></span>
                <p className="max-w-md text-sm text-muted">Demandez, par exemple :</p>
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">{EXAMPLES.map((e) => <button key={e} onClick={() => send(e)} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-ink">{e}</button>)}</div></div>)}
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm", m.role === "user" ? "bg-accent text-accentfg" : "bg-surface2")}>
                  {m.tools && m.tools.length > 0 && <div className="flex flex-wrap gap-1">{m.tools.map((t, k) => <Badge key={k} tone={t.is_action ? "amber" : "neutral"}><Wrench className="size-3" />{TOOL_LABEL[t.tool] ?? t.tool}</Badge>)}</div>}
                  <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                </div>
              </div>))}
            {busy && <div className="flex"><div className="rounded-2xl bg-surface2 px-4 py-2.5"><Spinner label="Claude analyse vos données…" /></div></div>}
            {err && <ErrorBox>{err}</ErrorBox>}
            <div ref={end} />
          </div>
          <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} rows={1} maxLength={4000} aria-label="Message"
              placeholder="Posez une question ou donnez un ordre…" className="min-h-10 flex-1 resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none" />
            <Button type="submit" loading={busy} aria-label="Envoyer"><Send className="size-4" /></Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
