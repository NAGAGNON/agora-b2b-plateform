import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Pagination par liens (accessible, indexable, compatible sans JavaScript). */
export function Pagination({
  page,
  pageCount,
  basePath,
  params,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  params: Record<string, string | string[] | undefined>;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === "page" || v === undefined || v === "") continue;
      (Array.isArray(v) ? v : [v]).forEach((x) => sp.append(k, x));
    }
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  const item = "inline-flex h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-semibold";
  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(item, "text-navy hover:bg-sky")} rel="prev">
          <ChevronLeft className="size-4" aria-hidden /> <span className="ml-1 hidden sm:inline">Précédent</span>
        </Link>
      ) : null}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className={cn(item, "text-slate-400")} aria-hidden>
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "bg-navy text-white" : "text-navy hover:bg-sky")}
          >
            {p}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link href={href(page + 1)} className={cn(item, "text-navy hover:bg-sky")} rel="next">
          <span className="mr-1 hidden sm:inline">Suivant</span> <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
