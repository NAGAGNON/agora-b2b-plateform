"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export function SortSelect({ value, hasQuery, hasPlace }: { value: string; hasQuery: boolean; hasPlace: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <span className="whitespace-nowrap">Trier par</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(sp.toString());
          next.set("tri", e.target.value);
          next.delete("page");
          router.push(`${pathname}?${next.toString()}`);
        }}
        className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-navy"
      >
        <option value="recent">Plus récentes</option>
        <option value="deadline">Échéance la plus proche</option>
        {hasQuery && <option value="relevance">Pertinence</option>}
        {hasPlace && <option value="distance">Distance</option>}
      </select>
    </label>
  );
}
