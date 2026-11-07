import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export type QuickTile = { href: string; title: string; text: string; image: string };

/** Raccourcis illustrés vers les grandes actions de l'espace membre. */
export function QuickTiles({ tiles }: { tiles: QuickTile[] }) {
  return (
    <nav aria-label="Accès rapides">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <li key={t.href} className="animate-rise" style={{ animationDelay: `${120 + i * 70}ms` }}>
            <Link href={t.href} className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-teal/40">
              <span aria-hidden className="relative block h-24 overflow-hidden sm:h-28">
                <Image src={t.image} alt="" fill unoptimized sizes="(min-width: 1024px) 20vw, 50vw" className="object-cover transition duration-700 group-hover:scale-110" />
                <span className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent" />
                <span className="absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-full bg-white/90 text-navy shadow transition group-hover:rotate-45 group-hover:bg-teal">
                  <ArrowUpRight className="size-4" />
                </span>
              </span>
              <span className="flex flex-1 flex-col px-4 pt-1 pb-4">
                <span className="font-bold text-navy group-hover:text-teal-700">{t.title}</span>
                <span className="mt-0.5 text-xs leading-relaxed text-slate-500">{t.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
