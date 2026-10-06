"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export type NotificationItem = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

/** Centre de notifications internes (cloche dans l'en-tête). */
export function NotificationCenter({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-navy hover:bg-sky"
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}
        aria-expanded={open}
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-2 top-16 z-50 rounded-xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold text-navy">Notifications</p>
            {unread > 0 && (
              <button type="button" className="text-xs font-semibold text-teal-700 hover:underline" onClick={() => start(() => markAllNotificationsRead())}>
                Tout marquer comme lu
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">Aucune notification pour le moment.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((n) => {
                const content = (
                  <>
                    <p className={cn("text-sm text-navy", !n.read_at && "font-semibold")}>{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">{relativeTime(n.created_at)}</p>
                  </>
                );
                return (
                  <li key={n.id} className={cn(!n.read_at && "bg-sky/50")}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        className="block px-4 py-3 hover:bg-sky"
                        onClick={() => {
                          setOpen(false);
                          if (!n.read_at) start(() => markNotificationRead(n.id));
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Link href="/dashboard/notifications" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-3 text-center text-sm font-semibold text-teal-700 hover:bg-sky">
            Voir toutes les notifications
          </Link>
        </div>
      )}
    </div>
  );
}
