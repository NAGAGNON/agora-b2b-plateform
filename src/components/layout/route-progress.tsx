"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Fine barre en haut de l'écran dès qu'on clique un lien interne, jusqu'à l'arrivée sur la page. */
export function RouteProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 0);
    return () => clearTimeout(t);
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setLoading(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return loading ? <div className="route-progress" aria-hidden /> : null;
}
