import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LogoLink } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { NotificationCenter, type NotificationItem } from "@/components/layout/notification-center";
import { AccountMenu } from "@/components/layout/account-menu";
import { NavLink } from "@/components/layout/nav-link";
import { RealtimeRefresh } from "@/components/realtime";
import { env } from "@/lib/env";

export const PUBLIC_NAV = [
  { href: "/opportunites", label: "Explorer les opportunités" },
  { href: "/publier", label: "Publier un besoin" },
  { href: "/entreprises", label: "Annuaire" },
  { href: "/analyses", label: "Analyses", wide: true },
  { href: "/ressources", label: "Ressources" },
];

export const ACCOUNT_NAV = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/dashboard/opportunites", label: "Opportunités" },
  { href: "/dashboard/pipeline", label: "Pipeline" },
  { href: "/dashboard/favoris", label: "Favoris" },
  { href: "/dashboard/alertes", label: "Alertes" },
  { href: "/dashboard/messages", label: "Messages" },
  { href: "/dashboard/profil", label: "Profil" },
];

export async function Header() {
  const session = await getSession();
  let notifications: NotificationItem[] = [];
  let unreadNotifications = 0;
  let unreadMessages = 0;
  if (session) {
    const supabase = await createClient();
    const companyIds = session.memberships.map((m) => m.company.id);
    const [{ data: notifs }, { count }, msgs] = await Promise.all([
      supabase.from("notifications").select("id, title, body, link, read_at, created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      companyIds.length
        ? supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .is("read_at", null)
            .not("sender_company_id", "in", `(${companyIds.join(",")})`)
        : Promise.resolve({ count: 0 }),
    ]);
    notifications = notifs ?? [];
    unreadNotifications = count ?? 0;
    unreadMessages = msgs.count ?? 0;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-navy focus:px-3 focus:py-2 focus:text-white">
        Aller au contenu
      </a>
      <div className="container-page flex h-16 items-center gap-4">
        <LogoLink />
        <nav aria-label="Navigation principale" className="ml-4 hidden items-center gap-1 lg:flex">
          {session && <NavLink href="/dashboard">Tableau de bord</NavLink>}
          {PUBLIC_NAV.map((l) => (
            // Lien « Analyses » affiché à partir de 1280 px dans la barre (toujours présent dans le menu mobile et le pied de page)
            <NavLink key={l.href} href={l.href} className={"wide" in l ? "hidden xl:inline-block" : undefined}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {session ? (
            <>
              <RealtimeRefresh
                config={env.realtime}
                channel={`user:${session.userId}`}
                watch={[
                  { table: "notifications", event: "INSERT", filter: `user_id=eq.${session.userId}` },
                  { table: "messages", event: "INSERT" },
                ]}
              />
              <Link
                href="/dashboard/messages"
                className="relative rounded-lg p-2 text-navy hover:bg-sky"
                aria-label={`Messages${unreadMessages ? ` (${unreadMessages} non lus)` : ""}`}
              >
                <MessageSquare className="size-5" aria-hidden />
                {unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-teal px-1 text-[11px] font-bold text-navy">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
              </Link>
              <NotificationCenter items={notifications} unread={unreadNotifications} />
              <div className="hidden lg:block">
                <AccountMenu
                  name={session.profile.full_name || session.email}
                  email={session.email}
                  company={session.activeCompany?.company.name ?? null}
                  isStaff={session.isStaff}
                  links={ACCOUNT_NAV.slice(1)}
                />
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 lg:flex">
              <ButtonLink href="/connexion" variant="ghost">
                Connexion
              </ButtonLink>
              <ButtonLink href="/inscription">Créer un compte</ButtonLink>
            </div>
          )}
          <MobileMenu
            signedIn={Boolean(session)}
            isStaff={session?.isStaff ?? false}
            name={session ? session.profile.full_name || session.email : null}
            publicLinks={PUBLIC_NAV}
            accountLinks={ACCOUNT_NAV}
          />
        </div>
      </div>
    </header>
  );
}
