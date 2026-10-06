import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { SECTORS, SECTOR_LABELS, type SectorOption } from "@/lib/constants";
import { env } from "@/lib/env";

export const getSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("key, value");
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, Record<string, unknown>>;
});

/**
 * Les données de démonstration ne sont jamais affichées en production (et ne
 * peuvent pas y être chargées) ; ailleurs, l'administrateur peut les masquer.
 */
export const showDemoData = cache(async (): Promise<boolean> => {
  if (env.isProduction) return false;
  const settings = await getSettings().catch(() => ({}) as Record<string, Record<string, unknown>>);
  return settings.demo?.visible !== false;
});

/** Vrai si des données de démonstration existent (affiche le bandeau d'avertissement). */
export const hasDemoData = cache(async (): Promise<boolean> => {
  try {
    const settings = await getSettings();
    if (settings.demo && settings.demo.show_banner === false) return false;
    if (!(await showDemoData())) return false;
    const supabase = await createClient();
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      supabase.from("companies").select("id", { count: "exact", head: true }).eq("is_demo", true),
      supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("is_demo", true),
    ]);
    return (c1 ?? 0) + (c2 ?? 0) > 0;
  } catch {
    return false;
  }
});

export const getDepartments = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("departments").select("code, name, slug, region").order("code");
  return data ?? [];
});

/** « Brest (29) », ou « Finistère (29) » quand seule la localisation départementale est connue. */
export const getLocationLabel = cache(async () => {
  const names = Object.fromEntries((await getDepartments()).map((d) => [d.code, d.name]));
  return (city: string | null | undefined, code: string | null | undefined) =>
    [city ?? (code ? names[code] : null), code ? `(${code})` : null].filter(Boolean).join(" ");
});

export const getPlaces = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("places").select("name, slug, postal_code, department_code").order("name");
  return data ?? [];
});

/** Secteurs actifs (table de référence administrable). */
export const getSectors = cache(async (): Promise<SectorOption[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("sectors").select("slug, label").eq("is_active", true).order("sort_order");
  return data?.length ? data : SECTORS.map((s) => ({ slug: s.slug, label: s.label }));
});

export const getSectorLabels = cache(async (): Promise<Record<string, string>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("sectors").select("slug, label");
  return { ...SECTOR_LABELS, ...Object.fromEntries((data ?? []).map((s) => [s.slug, s.label])) };
});
