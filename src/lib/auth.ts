import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
export type Membership = {
  id: string;
  role: Database["public"]["Enums"]["company_role"];
  company: Pick<CompanyRow, "id" | "slug" | "name" | "kind" | "status" | "logo_path" | "is_demo" | "verified_at">;
};

export type Session = {
  userId: string;
  email: string;
  profile: UserRow;
  memberships: Membership[];
  activeCompany: Membership | null;
  isStaff: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  mfaLevel: "aal1" | "aal2" | null;
};

export const ACTIVE_COMPANY_COOKIE = "lp_company";

/** Session courante (mise en cache pour la durée de la requête). */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: members }] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("company_members")
      .select("id, role, company:companies(id, slug, name, kind, status, logo_path, is_demo, verified_at)")
      .eq("user_id", user.id)
      .order("created_at"),
  ]);
  if (!profile) return null;

  const memberships = (members ?? []).filter((m) => m.company) as unknown as Membership[];
  const cookieStore = await cookies();
  const wanted = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  const activeCompany = memberships.find((m) => m.company.id === wanted) ?? memberships[0] ?? null;

  const role = profile.platform_role;
  const active = profile.status === "ACTIVE";
  let mfaLevel: Session["mfaLevel"] = null;
  if (active && role !== "USER") {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    mfaLevel = (data?.currentLevel as Session["mfaLevel"]) ?? null;
  }
  return {
    userId: user.id,
    email: user.email ?? profile.email,
    profile,
    memberships,
    activeCompany,
    isStaff: active && ["MODERATOR", "ADMIN", "SUPER_ADMIN"].includes(role),
    isAdmin: active && ["ADMIN", "SUPER_ADMIN"].includes(role),
    isSuperAdmin: active && role === "SUPER_ADMIN",
    mfaLevel,
  };
});

export async function requireSession(next?: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/connexion${next ? `?suite=${encodeURIComponent(next)}` : ""}`);
  if (session.profile.status === "SUSPENDED") redirect("/compte-suspendu");
  return session;
}

/** Exige une entreprise active (sinon redirection vers la création d'entreprise). */
export async function requireCompany(next?: string): Promise<Session & { activeCompany: Membership }> {
  const session = await requireSession(next);
  if (!session.activeCompany) redirect(`/onboarding/entreprise${next ? `?suite=${encodeURIComponent(next)}` : ""}`);
  return session as Session & { activeCompany: Membership };
}

export async function requireStaff(): Promise<Session> {
  const session = await requireSession("/admin");
  if (!session.isStaff) redirect("/dashboard?refus=admin");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireStaff();
  if (!session.isAdmin) redirect("/admin?refus=admin");
  return session;
}
