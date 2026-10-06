"use client";

import { useTransition } from "react";
import { switchCompany } from "@/app/actions/company";

export function CompanySwitcher({ companies, activeId }: { companies: { id: string; name: string }[]; activeId: string | null }) {
  const [pending, start] = useTransition();
  if (companies.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Entreprise :</span>
      <select
        disabled={pending}
        value={activeId ?? ""}
        onChange={(e) => start(() => switchCompany(e.target.value))}
        className="h-9 rounded-lg border border-slate-300 bg-white px-2 font-semibold text-navy"
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
