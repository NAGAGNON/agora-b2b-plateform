import Image from "next/image";
import { SECTOR_FAMILIES } from "@/lib/sector-families";

/**
 * Photo de chaque famille de métiers (Unsplash, licence libre), hébergée dans
 * public/images/secteurs et déjà compressée : servie telle quelle, sans service d'images.
 */
const FAMILY_SLUGS = new Set(SECTOR_FAMILIES.map((f) => f.slug));

export function sectorFamilySlug(sector: string | null | undefined): string | null {
  if (!sector) return null;
  return SECTOR_FAMILIES.find((f) => f.sectors.includes(sector))?.slug ?? null;
}

export function familyPhoto(family: string | null | undefined): string {
  return `/images/secteurs/${family && FAMILY_SLUGS.has(family) ? family : "autres"}.webp`;
}

/** Bandeau photo d'une opportunité (selon la famille de son secteur) ou d'une famille. */
export function SectorVisual({
  sector,
  family,
  className = "",
  priority = false,
}: {
  sector?: string | null;
  family?: string;
  className?: string;
  priority?: boolean;
}) {
  const src = familyPhoto(family ?? sectorFamilySlug(sector));
  return (
    <div aria-hidden className={`relative overflow-hidden bg-navy ${className}`}>
      <Image
        src={src}
        alt=""
        fill
        unoptimized
        priority={priority}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="object-cover transition duration-500 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-navy/40 to-transparent" />
    </div>
  );
}
