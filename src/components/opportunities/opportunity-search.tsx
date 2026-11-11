"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Briefcase, Factory, Loader2, MapPin, Search, Tag, X } from "lucide-react";
import type { Suggestion } from "@/lib/search-suggest";

const IDEAS = ["maintenance", "nettoyage", "informatique", "cybersécurité", "travaux", "transport", "formation", "électricité"];

const KIND_ICON = { mot: Tag, secteur: Factory, departement: MapPin, ville: MapPin } as const;

/** Met en gras la partie déjà tapée (début du libellé ou d'un mot), sans tenir compte des accents. */
function Highlight({ label, query }: { label: string; query: string }) {
  const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = n(query.trim());
  const l = n(label);
  let at = l.startsWith(q) ? 0 : -1;
  if (at < 0) {
    const m = l.search(new RegExp(`(^|[\\s\\-/(])${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    at = m < 0 ? -1 : m + (l[m] === q[0] ? 0 : 1);
  }
  if (!q || at < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, at)}
      <strong className="font-bold text-navy">{label.slice(at, at + q.length)}</strong>
      {label.slice(at + q.length)}
    </>
  );
}

/**
 * Grande recherche des opportunités : suggestions pendant la frappe (métiers, secteurs, départements,
 * villes), résultats mis à jour après une courte pause, autres filtres conservés. Sans JavaScript, le
 * formulaire GET reste utilisable.
 */
export function OpportunitySearch({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(initial);
  const [pending, start] = useTransition();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const listId = useId();

  const navigate = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    mutate(next);
    const s = next.toString();
    start(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
  };

  const go = (value: string) =>
    navigate((p) => {
      if (value.trim()) p.set("q", value.trim());
      else p.delete("q");
    });

  const loadSuggestions = (value: string) => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    if (value.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    suggestTimer.current = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const r = await fetch(`/api/recherche/suggestions?q=${encodeURIComponent(value.trim())}`, { signal: ctrl.signal });
        if (!r.ok) return;
        const { items: next } = (await r.json()) as { items: Suggestion[] };
        setItems(next);
        setActive(-1);
        setOpen(next.length > 0);
      } catch {
        // frappe suivante ou réseau indisponible : la recherche classique reste possible
      }
    }, 150);
  };

  const choose = (s: Suggestion) => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
    if (s.kind === "mot") {
      setQ(s.label);
      go(s.label);
      return;
    }
    // Secteur ou lieu : devient un filtre, la saisie est effacée
    setQ("");
    navigate((p) => {
      p.delete("q");
      if (s.kind === "secteur") p.set("secteur", s.value);
      if (s.kind === "departement") p.set("departement", s.value);
      if (s.kind === "ville") p.set("ville", s.value);
    });
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (suggestTimer.current) clearTimeout(suggestTimer.current);
      abort.current?.abort();
    },
    [],
  );

  return (
    <form
      action={pathname}
      method="get"
      role="search"
      aria-label="Rechercher une opportunité"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        if (open && active >= 0 && items[active]) return choose(items[active]);
        setOpen(false);
        go(q);
      }}
      className="relative max-w-3xl"
    >
      {Array.from(params.entries())
        .filter(([k]) => k !== "q" && k !== "page")
        .map(([k, v], i) => (
          <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
        ))}
      <div className="group relative flex items-center gap-2 rounded-2xl bg-white p-2 shadow-[0_20px_50px_-20px_rgb(11_27_52/0.35)] ring-1 ring-slate-200 transition focus-within:ring-4 focus-within:ring-teal/25">
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
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => {
            const v = e.target.value;
            setQ(v);
            loadSuggestions(v);
            if (timer.current) clearTimeout(timer.current);
            // Recherche après une courte pause, dès 3 lettres (ou champ vidé) : pas de « 0 résultat » à chaque lettre
            const t = v.trim();
            if (t.length === 0 || t.length >= 3) timer.current = setTimeout(() => go(v), 700);
          }}
          onKeyDown={(e) => {
            if (!open || !items.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => (a + 1) % items.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          onFocus={() => items.length > 0 && q.trim().length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Métier, mot-clé, ville…"
          className="h-12 min-w-0 flex-1 bg-transparent text-base text-navy placeholder:text-slate-400 focus:outline-none"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setItems([]);
              setOpen(false);
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

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          className="relative z-30 mt-2 max-h-80 animate-pop overflow-y-auto rounded-2xl bg-white p-1.5 shadow-2xl ring-1 ring-slate-200"
        >
          {items.map((s, i) => {
            const Icon = s.kind === "mot" ? KIND_ICON.mot : s.kind === "secteur" ? Factory : s.kind === "ville" ? MapPin : KIND_ICON.departement;
            return (
              <li
                key={`${s.kind}-${s.value}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${i === active ? "bg-teal-50 text-navy" : "text-slate-700"}`}
              >
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${s.kind === "mot" ? "bg-slate-100 text-slate-500" : "bg-teal-50 text-teal-700"}`} aria-hidden>
                  {s.kind === "secteur" ? <Briefcase className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  <Highlight label={s.label} query={q} />
                </span>
                {s.hint && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{s.hint}</span>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Idées :</span>
        {IDEAS.map((idea) => (
          <button
            key={idea}
            type="button"
            onClick={() => {
              setQ(idea);
              setOpen(false);
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
