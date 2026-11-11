"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

const IDEAS = ["maintenance", "nettoyage", "informatique", "cybersécurité", "travaux", "transport", "formation", "électricité"];

/**
 * Grande recherche des opportunités : les résultats se mettent à jour pendant la frappe (après une
 * courte pause), les autres filtres sont conservés. Sans JavaScript, le formulaire GET reste utilisable.
 */
export function OpportunitySearch({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(initial);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (value: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    if (value.trim()) next.set("q", value.trim());
    else next.delete("q");
    const s = next.toString();
    start(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <form
      action={pathname}
      method="get"
      role="search"
      aria-label="Rechercher une opportunité"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(q);
      }}
      className="max-w-3xl"
    >
      {Array.from(params.entries())
        .filter(([k]) => k !== "q" && k !== "page")
        .map(([k, v], i) => (
          <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
        ))}
      <div className="group flex items-center gap-2 rounded-2xl bg-white p-2 shadow-[0_20px_50px_-20px_rgb(11_27_52/0.35)] ring-1 ring-slate-200 transition focus-within:ring-4 focus-within:ring-teal/25">
        <label htmlFor="opp-search" className="sr-only">
          Rechercher une opportunité
        </label>
        <span className="pl-2 text-slate-400 transition group-focus-within:text-teal-600">
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Search className="size-5" aria-hidden />}
        </span>
        <input
          id="opp-search"
          name="q"
          value={q}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => {
            const v = e.target.value;
            setQ(v);
            if (timer.current) clearTimeout(timer.current);
            // Recherche après une courte pause, dès 3 lettres (ou champ vidé) : pas de « 0 résultat » à chaque lettre
            const t = v.trim();
            if (t.length === 0 || t.length >= 3) timer.current = setTimeout(() => go(v), 700);
          }}
          placeholder="Métier, mot-clé, ville…"
          className="h-12 min-w-0 flex-1 bg-transparent text-base text-navy placeholder:text-slate-400 focus:outline-none"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              go("");
            }}
            className="flex size-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-navy"
            aria-label="Effacer la recherche"
          >
            <X className="size-4" />
          </button>
        )}
        <button type="submit" className="btn-shine hidden h-12 rounded-xl bg-gradient-to-r from-teal to-cyan-400 px-6 text-sm font-bold text-navy shadow-md transition hover:-translate-y-px sm:block">
          Rechercher
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Idées :</span>
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => {
              setQ(idea);
              go(idea);
            }}
            className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:-translate-y-px hover:text-teal-700 hover:ring-teal/40"
          >
            {idea}
          </button>
        ))}
      </div>
    </form>
  );
}
