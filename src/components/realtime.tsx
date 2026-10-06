"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/cn";

export type RealtimeConfig = { url: string; key: string };
export type RealtimeWatch = { table: "messages" | "notifications"; event?: "INSERT" | "UPDATE" | "*"; filter?: string };

/**
 * Rafraîchit la page (rendu serveur) dès qu'un changement pertinent arrive en
 * temps réel : nouveau message, message lu, nouvelle notification.
 * Aucune donnée n'est lue depuis le navigateur au-delà de l'événement.
 */
export function RealtimeRefresh({ config, watch, channel, indicator = false }: { config: RealtimeConfig; watch: RealtimeWatch[]; channel: string; indicator?: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = JSON.stringify(watch);

  useEffect(() => {
    const supabase = getBrowserClient(config.url, config.key);
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };
    let ch: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    // La session (cookies) est chargée de façon asynchrone : on attend le jeton
    // avant de s'abonner, sinon l'abonnement serait anonyme et filtré par la RLS.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      ch = supabase.channel(`${channel}:${Math.random().toString(36).slice(2, 8)}`);
      for (const w of JSON.parse(key) as RealtimeWatch[]) {
        ch = ch.on("postgres_changes", { event: w.event ?? "INSERT", schema: "public", table: w.table, ...(w.filter ? { filter: w.filter } : {}) }, refresh);
      }
      ch.subscribe((s, err) => {
        if (err) console.warn("realtime", channel, s, err.message);
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("offline");
      });
    });
    // Au retour sur l'onglet, resynchronisation (événements manqués pendant la veille).
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      if (ch) void supabase.removeChannel(ch);
    };
  }, [config.url, config.key, channel, key, router]);

  if (!indicator) return <span hidden data-realtime-channel={channel.split(":")[0]} data-realtime={status} />;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" role="status" data-realtime-channel={channel.split(":")[0]} data-realtime={status}>
      <span className={cn("size-2 rounded-full", status === "live" ? "bg-green-500" : status === "offline" ? "bg-slate-400" : "animate-pulse bg-amber-400")} aria-hidden />
      {status === "live" ? "En direct" : status === "offline" ? "Hors ligne — mise à jour à la prochaine action" : "Connexion…"}
    </span>
  );
}

/** Fait défiler une liste jusqu'au dernier élément quand son contenu change. */
export function ScrollToEnd({ count, targetId }: { count: number; targetId: string }) {
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, targetId]);
  return null;
}
