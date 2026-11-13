"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

type Item = { kind: "group"; label: string } | { kind: "option"; value: string; label: string; disabled: boolean; group: boolean };

const SEARCH_FROM = 12;
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function readItems(el: HTMLSelectElement): Item[] {
  const out: Item[] = [];
  for (const child of Array.from(el.children)) {
    if (child instanceof HTMLOptGroupElement) {
      out.push({ kind: "group", label: child.label });
      for (const o of Array.from(child.children))
        if (o instanceof HTMLOptionElement && !o.hidden) out.push({ kind: "option", value: o.value, label: o.text, disabled: o.disabled, group: true });
    } else if (child instanceof HTMLOptionElement && !child.hidden) {
      out.push({ kind: "option", value: child.value, label: child.text, disabled: child.disabled, group: false });
    }
  }
  return out;
}

/** Valeur choisie dans la liste : passe par le vrai <select> (formulaires, onChange de React, accessibilité). */
function commit(el: HTMLSelectElement, value: string) {
  if (el.value === value) return;
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Liste déroulante moderne : le vrai <select> reste en place (libellé, formulaire, lecteurs d'écran, sélecteur
 * natif des téléphones), seule la liste ouverte à la souris ou au clavier est remplacée par un panneau animé,
 * avec familles de métiers, recherche quand la liste est longue et coche sur le choix en cours.
 */
export function SelectMenu({ className, children, onPointerDown, onKeyDown, wrapperClassName, ...props }: ComponentProps<"select"> & { wrapperClassName?: string }) {
  const ref = useRef<HTMLSelectElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [current, setCurrent] = useState("");
  const [activeRaw, setActive] = useState(-1);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 260 && above > below;
    const width = Math.max(r.width, 240);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos(up ? { left, width, bottom: window.innerHeight - r.top + 6, maxHeight: Math.min(380, above) } : { left, width, top: r.bottom + 6, maxHeight: Math.min(380, below) });
  }, []);

  const options = items.filter((i): i is Extract<Item, { kind: "option" }> => i.kind === "option");
  const searchable = options.length >= SEARCH_FROM;
  const q = norm(query.trim());
  const visible: Item[] = q
    ? items.filter((i, idx) => {
        if (i.kind === "option") return norm(i.label).includes(q);
        // Famille affichée si l'une de ses options correspond
        for (let j = idx + 1; j < items.length && items[j].kind === "option"; j++) if (norm((items[j] as { label: string }).label).includes(q)) return true;
        return false;
      })
    : items;
  const selectable = visible.map((i, idx) => (i.kind === "option" && !i.disabled ? idx : -1)).filter((i) => i >= 0);
  // Pendant une recherche, le premier résultat est pré-sélectionné (Entrée le choisit)
  const active = selectable.includes(activeRaw) ? activeRaw : q ? (selectable[0] ?? -1) : activeRaw;

  const show = useCallback(() => {
    const el = ref.current;
    if (!el || el.disabled) return;
    const list = readItems(el);
    setItems(list);
    setCurrent(el.value);
    setQuery("");
    setActive(list.findIndex((i) => i.kind === "option" && i.value === el.value));
    place();
    setOpen(true);
  }, [place]);

  const close = useCallback((focus = true) => {
    setOpen(false);
    if (focus) ref.current?.focus({ preventScroll: true });
  }, []);

  const choose = (value: string) => {
    if (ref.current) commit(ref.current, value);
    close();
  };

  // Fermeture : clic ailleurs, défilement de la page, redimensionnement
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (listRef.current?.contains(t) || ref.current?.contains(t)) return;
      close(false);
    };
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  // Focus sur la recherche, choix en cours visible
  useLayoutEffect(() => {
    if (!open) return;
    if (searchable) searchRef.current?.focus({ preventScroll: true });
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, searchable]);
  useLayoutEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const move = (dir: 1 | -1) => {
    if (!selectable.length) return;
    const at = selectable.indexOf(active);
    const next = at < 0 ? (dir === 1 ? selectable[0] : selectable[selectable.length - 1]) : selectable[Math.min(selectable.length - 1, Math.max(0, at + dir))];
    setActive(next);
  };

  const listKeys = (e: KeyboardEvent) => {
    const first = selectable[0];
    const last = selectable[selectable.length - 1];
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        if (first !== undefined) setActive(first);
        break;
      case "End":
        e.preventDefault();
        if (last !== undefined) setActive(last);
        break;
      case "Enter": {
        e.preventDefault();
        const it = visible[active];
        if (it && it.kind === "option" && !it.disabled) choose(it.value);
        break;
      }
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        close(false);
        break;
    }
  };

  const listId = `${props.id ?? props.name ?? "select"}-menu`;

  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        ref={ref}
        className={cn("w-full cursor-pointer appearance-none pr-9", className)}
        aria-expanded={open || undefined}
        aria-controls={open ? listId : undefined}
        onPointerDown={(e: PointerEvent<HTMLSelectElement>) => {
          onPointerDown?.(e);
          // Souris : notre liste ; doigt ou stylet : le sélecteur natif du téléphone, plus pratique
          if (e.defaultPrevented || e.pointerType !== "mouse" || e.button !== 0) return;
          e.preventDefault();
          ref.current?.focus({ preventScroll: true });
          if (open) close();
          else show();
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (open) return listKeys(e);
          if (e.key === "Enter" || e.key === " " || e.key === "F4" || (e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp"))) {
            e.preventDefault();
            show();
          }
        }}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className={cn("pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400 transition-transform duration-200", open && "rotate-180 text-teal-700")} aria-hidden />
      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            className="select-menu fixed z-[70] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-navy/15 ring-1 ring-slate-900/5"
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight, transformOrigin: pos.top !== undefined ? "top" : "bottom" }}
          >
            {searchable && (
              <div className="border-b border-slate-100 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(-1);
                    }}
                    onKeyDown={listKeys}
                    placeholder="Rechercher…"
                    aria-label="Rechercher dans la liste"
                    aria-controls={`${listId}-box`}
                    className="h-10 w-full rounded-xl bg-slate-50 pr-3 pl-9 text-sm text-navy ring-1 ring-slate-200 outline-none focus:bg-white focus:ring-2 focus:ring-teal/40"
                  />
                </div>
              </div>
            )}
            <div id={`${listId}-box`} role="listbox" aria-label={props["aria-label"] ?? "Choix"} className="overflow-y-auto overscroll-contain p-1.5" onKeyDown={listKeys}>
              {visible.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">Aucun résultat</p>}
              {visible.map((it, idx) =>
                it.kind === "group" ? (
                  <p key={`g-${it.label}-${idx}`} className="sticky top-0 z-10 mt-1 bg-white/95 px-3 pt-2 pb-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase first:mt-0">
                    {it.label}
                  </p>
                ) : (
                  <div
                    key={`o-${it.value}-${idx}`}
                    role="option"
                    aria-selected={it.value === current}
                    aria-disabled={it.disabled || undefined}
                    data-active={idx === active}
                    onPointerEnter={() => !it.disabled && setActive(idx)}
                    onClick={() => !it.disabled && choose(it.value)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[14px] text-navy transition-colors duration-100",
                      it.group && "pl-5",
                      idx === active && "bg-teal-50 text-teal-900",
                      it.value === current && "font-semibold",
                      it.disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
                    {it.value === current && <Check className="size-4 shrink-0 text-teal-700" aria-hidden />}
                  </div>
                ),
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
