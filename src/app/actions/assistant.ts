"use server";

import { z } from "zod";
import { getSectors } from "@/lib/queries/platform";
import { searchOpportunities } from "@/lib/queries/opportunities";
import { parseOpportunityFilters } from "@/lib/search-params";
import { groupSectors } from "@/lib/sector-families";
import { REGIONS } from "@/lib/geo";
import { rateLimit } from "@/lib/rate-limit";

export type AssistantSetup = {
  families: { slug: string; label: string; sectors: { slug: string; label: string }[] }[];
  regions: { slug: string; name: string }[];
};

/** Listes de l'assistant guidé (familles de métiers, régions), chargées à l'ouverture seulement. */
export async function assistantSetup(): Promise<AssistantSetup> {
  const families = groupSectors(await getSectors()).map(({ family, sectors }) => ({
    slug: family.slug,
    label: family.label,
    sectors: sectors.map((s) => ({ slug: s.slug, label: s.label })),
  }));
  return { families, regions: REGIONS.map((r) => ({ slug: r.slug, name: r.name })) };
}

export type AssistantPreview = { ok: true; total: number; items: { id: string; title: string; by: string | null }[] } | { ok: false };

const previewSchema = z.object({
  sector: z.string().regex(/^[a-z0-9-]{1,60}$/).nullable(),
  region: z.string().regex(/^[a-z0-9-]{1,80}$/).nullable(),
});

/** Nombre réel d'opportunités ouvertes et les trois plus récentes pour le secteur et la région choisis. */
export async function assistantPreview(sector: string | null, region: string | null): Promise<AssistantPreview> {
  const parsed = previewSchema.safeParse({ sector, region });
  if (!parsed.success || !(await rateLimit("assistant", 60, 3600))) return { ok: false };
  const filters = parseOpportunityFilters({ secteur: parsed.data.sector ?? undefined, region: parsed.data.region ?? undefined, tri: "recent" });
  const { rows, total, error } = await searchOpportunities(filters, 3);
  if (error) return { ok: false };
  return {
    ok: true,
    total: Number(total),
    items: rows.map((r) => ({ id: r.id, title: r.title, by: (r.origin === "EXTERNAL" ? r.external_buyer_name : r.company_name) ?? null })),
  };
}
