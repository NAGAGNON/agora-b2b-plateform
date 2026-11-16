"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

function messageOf(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((e: { loc?: string[]; msg?: string }) => `${(e.loc ?? []).slice(1).join(".")} : ${e.msg}`).join(" ; ");
  }
  return status >= 500 ? "Erreur du serveur. Réessayez ou consultez les journaux." : `Requête refusée (${status}).`;
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal,
      credentials: "same-origin",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Serveur injoignable. Vérifiez que l'API est démarrée.", 0);
  }
  if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
    location.href = "/login";
  }
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non JSON */ }
  if (!res.ok) throw new ApiError(messageOf(json, res.status), res.status);
  return json as T;
}

export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const ctl = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (path === null) return;
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setLoading(true);
    try {
      const d = await api<T>(path, { signal: c.signal });
      if (!c.signal.aborted) { setData(d); setError(null); }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, [path]);  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); return () => ctl.current?.abort(); }, [load, ...deps]);
  return { data, error, loading, reload: load, setData };
}
