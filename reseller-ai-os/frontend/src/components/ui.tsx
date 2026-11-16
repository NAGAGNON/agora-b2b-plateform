"use client";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export const cn = clsx;

type Tone = "neutral" | "green" | "red" | "amber" | "blue";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface2 text-muted",
  green: "bg-accentsoft text-accent",
  red: "bg-dangersoft text-danger",
  amber: "bg-warnsoft text-warn",
  blue: "bg-infosoft text-info",
};
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

export function Button({ variant = "primary", size = "md", loading, className, children, ...p }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; loading?: boolean }) {
  const v = {
    primary: "bg-accent text-accentfg hover:opacity-90",
    secondary: "border border-line bg-surface hover:bg-surface2",
    ghost: "hover:bg-surface2 text-muted hover:text-ink",
    danger: "bg-danger text-white hover:opacity-90",
  }[variant];
  return (
    <button {...p} disabled={p.disabled || loading}
      className={cn("inline-flex items-center justify-center gap-2 rounded-lg font-medium transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm", v, className)}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("rounded-xl border border-line bg-surface", className)}>{children}</div>;
}
export function CardHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
      <div><h3 className="text-sm font-semibold">{title}</h3>{sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}</div>
      {action}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold tracking-tight">{title}</h1>{sub && <p className="text-sm text-muted mt-1 max-w-2xl">{sub}</p>}</div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export function StatCard({ label, value, sub, tone, hint }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "good" | "bad"; hint?: string }) {
  return (
    <Card className="p-4 anim-in" title={hint}>
      <div className="text-xs text-muted">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tabular-nums", tone === "good" && "text-accent", tone === "bad" && "text-danger")}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

export const inputCls = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none disabled:opacity-60";
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  // <label> enveloppant : l'association au champ est implicite (accessible sans id)
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(inputCls, p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cn(inputCls, "min-h-24", p.className)} />;
export const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(inputCls, p.className)} />;

export function ErrorBox({ children, onRetry }: { children: React.ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-dangersoft px-3 py-2 text-sm text-danger">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" /><div className="flex-1">{children}</div>
      {onRetry && <button onClick={onRetry} className="underline">Réessayer</button>}
    </div>
  );
}
export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return <div className="flex items-center gap-2 p-6 text-sm text-muted"><Loader2 className="size-4 animate-spin" />{label}</div>;
}
export function Empty({ title, children, icon }: { title: string; children?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div className="font-medium">{title}</div>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className={cn("anim-pop flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-xl sm:rounded-2xl", wide ? "sm:max-w-4xl" : "sm:max-w-xl")}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="rounded-md p-1 text-muted hover:bg-surface2"><X className="size-4" /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---- Toasts -------------------------------------------------------------------------------------
type Toast = { id: number; kind: "ok" | "err"; text: string };
const ToastCtx = createContext<{ ok: (t: string) => void; err: (t: string) => void }>({ ok: () => {}, err: () => {} });
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === "err" ? 8000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={{ ok: (t) => push("ok", t), err: (t) => push("err", t) }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn("anim-pop pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg",
            t.kind === "ok" ? "border-accent/30 bg-surface" : "border-danger/40 bg-dangersoft text-danger")}>
            {t.kind === "ok" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/** Exécute une action asynchrone avec état de chargement + toast de succès/erreur (les erreurs de l'API sont affichées telles quelles). */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(async <T,>(key: string, fn: () => Promise<T>, okMsg?: string): Promise<T | undefined> => {
    setBusy(key);
    try {
      const r = await fn();
      if (okMsg) toast.ok(okMsg);
      return r;
    } catch (e) {
      toast.err((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [toast]);
  return { busy, run };
}

export function ScorePill({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <Badge tone="neutral" className="">non noté</Badge>;
  const tone: Tone = score >= 75 ? "green" : score >= 50 ? "amber" : "red";
  return <Badge tone={tone} className="tabular-nums">{score}/100</Badge>;
}

export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: string; count?: number }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}
          className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm transition", value === t.key ? "border-accent font-medium text-ink" : "border-transparent text-muted hover:text-ink")}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 rounded-full bg-surface2 px-1.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const tableCls = "w-full text-sm";
export const thCls = "px-3 py-2 text-left text-xs font-medium text-muted whitespace-nowrap";
export const tdCls = "px-3 py-2.5 align-middle";
export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className={tableCls}>{children}</table></div>;
}
