import Link from "next/link";
import { Bell } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead } from "@/app/actions/notifications";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await requireSession("/dashboard/notifications");
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).filter((n) => !n.read_at).length;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="outline" size="sm">
              Tout marquer comme lu ({unread})
            </Button>
          </form>
        )}
      </div>
      {!data?.length ? (
        <EmptyState icon={<Bell className="size-6" aria-hidden />} title="Aucune notification" description="Vous serez notifié des réponses, messages, décisions et alertes." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {data.map((n) => (
            <li key={n.id} className={cn("px-5 py-4", !n.read_at && "bg-sky/50")}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={cn("text-navy", !n.read_at && "font-semibold")}>{n.link ? <Link href={n.link} className="hover:underline">{n.title}</Link> : n.title}</p>
                <time className="text-xs text-slate-400" dateTime={n.created_at}>
                  {formatDateTime(n.created_at)}
                </time>
              </div>
              {n.body && <p className="mt-1 text-sm text-slate-600">{n.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
