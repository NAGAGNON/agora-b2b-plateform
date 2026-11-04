import "server-only";
import { cache } from "react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Profil de l'entreprise active utilisé pour expliquer la pertinence d'une offre. */
export type FitProfile = { sectors: string[]; skills: string[]; department: string | null; region: string | null };

/** Profil de l'entreprise du visiteur connecté (une seule lecture par page), ou null. */
export const getFitProfile = cache(async (): Promise<FitProfile | null> => {
  const session = await getSession();
  const id = session?.activeCompany?.company.id;
  if (!id) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("department_code, region, profile:company_profiles(sectors, skills)").eq("id", id).maybeSingle();
  if (!data) return null;
  const profile = (Array.isArray(data.profile) ? data.profile[0] : data.profile) as { sectors: string[] | null; skills: string[] | null } | null;
  return { sectors: profile?.sectors ?? [], skills: profile?.skills ?? [], department: data.department_code, region: data.region };
});

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Raisons simples et vérifiables pour lesquelles une offre concerne l'entreprise : son métier, sa
 * zone, une compétence citée dans l'intitulé ou le résumé. Rien n'est estimé ni inventé.
 */
export function fitReasons(
  o: { sector_slug: string | null; department_code?: string | null; region?: string | null; title: string; summary?: string | null },
  p: FitProfile,
): string[] {
  const reasons: string[] = [];
  if (o.sector_slug && p.sectors.includes(o.sector_slug)) reasons.push("Votre métier");
  if (o.department_code && p.department && o.department_code === p.department) reasons.push("Votre département");
  else if (o.region && p.region && o.region === p.region) reasons.push("Votre région");
  const text = norm(`${o.title} ${o.summary ?? ""}`);
  const skill = p.skills.find((s) => {
    const k = norm(s.trim());
    return k.length >= 4 && text.includes(k);
  });
  if (skill) reasons.push(`« ${skill.trim()} »`);
  return reasons;
}
