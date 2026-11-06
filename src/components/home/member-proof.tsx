"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, FileSearch, Sparkles, Users } from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-logo";
import { CountUp } from "@/components/home/count-up";
import type { MemberCompany } from "@/lib/queries/platform";

export type LiveStats = { members: number; members_7d: number; members_30d: number; companies: number; active: number };

/** Seuil d'affichage des nouveaux membres : une semaine calme n'est pas mise en avant. */
const MIN_RECENT = 5;

/** « +N cette semaine », sinon « +N ce mois-ci », sinon rien (jamais un petit chiffre en vitrine). */
export function recentGrowth(s: Pick<LiveStats, "members_7d" | "members_30d">): { value: number; label: string } | null {
  if (s.members_7d >= MIN_RECENT) return { value: s.members_7d, label: "cette semaine" };
  if (s.members_30d >= MIN_RECENT) return { value: s.members_30d, label: "ce mois-ci" };
  return null;
}

/** Chiffres réels relus toutes les 30 s tant que la page est visible : chaque inscription fait monter le compteur. */
function useLiveStats(initial: LiveStats) {
  const [stats, setStats] = useState(initial);
  const [joined, setJoined] = useState(false);
  const last = useRef(initial.members);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/stats/membres", { cache: "no-store" });
        if (!r.ok) return;
        const s = (await r.json()) as LiveStats;
        if (!alive || !s.members) return;
        if (s.members > last.current) {
          setJoined(true);
          setTimeout(() => alive && setJoined(false), 6000);
        }
        last.current = s.members;
        setStats(s);
      } catch {
        // réseau indisponible : les derniers chiffres restent affichés
      }
    };
    const id = setInterval(load, 30_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);
  return { stats, joined };
}

/** Bande des entreprises de l'annuaire public (leur choix), en défilement continu. */
export function LogoMarquee({ companies, tone = "dark" }: { companies: MemberCompany[]; tone?: "dark" | "light" }) {
  if (!companies.length) return null;
  // Assez d'éléments pour une boucle sans trou, même avec peu d'entreprises
  const loop = Array.from({ length: Math.max(1, Math.ceil(8 / companies.length)) }, () => companies).flat();
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-4 pr-4">
      {loop.map((c, i) => (
        <li key={`${c.slug}-${i}`}>
          <Link
            href={`/entreprises/${c.slug}`}
            tabIndex={hidden ? -1 : undefined}
            className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 whitespace-nowrap transition ${tone === "dark" ? "bg-white/5 ring-1 ring-white/10 hover:bg-white/10" : "bg-white ring-1 ring-slate-200 hover:ring-teal/40"}`}
          >
            <CompanyLogo name={c.name} path={c.logo_path} size={36} />
            <span>
              <span className={`block text-sm font-semibold ${tone === "dark" ? "text-white" : "text-navy"}`}>{c.name}</span>
              {(c.city || c.region) && <span className={`block text-xs ${tone === "dark" ? "text-white/55" : "text-slate-500"}`}>{c.city ?? c.region}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)] motion-reduce:overflow-x-auto">
      <div className="flex w-max animate-ticker hover:[animation-play-state:paused] motion-reduce:animate-none">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

/** Section d'accueil : compteurs en direct et entreprises membres. */
export function MemberProof({ initial, companies }: { initial: LiveStats; companies: MemberCompany[] }) {
  const { stats, joined } = useLiveStats(initial);
  const recent = recentGrowth(stats);
  const cards = [
    { icon: Users, value: stats.members, label: "professionnels inscrits" },
    { icon: Building2, value: stats.companies, label: "entreprises inscrites" },
    ...(recent ? [{ icon: Sparkles, value: recent.value, label: `nouveaux membres ${recent.label}`, plus: true }] : []),
    { icon: FileSearch, value: stats.active, label: "appels d'offres ouverts" },
  ].filter((c) => c.value > 0);
  return (
    <section aria-labelledby="membres" className="relative overflow-hidden bg-navy-900 py-14 text-white sm:py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="bg-tech-grid absolute inset-0 opacity-60" />
        <div className="absolute -top-32 left-1/4 size-96 animate-aurora rounded-full bg-teal/20 blur-3xl" />
        <div className="absolute -bottom-40 right-0 size-96 animate-aurora rounded-full bg-violet/20 blur-3xl [animation-delay:-8s]" />
      </div>
      <div className="relative container-page">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-teal-300">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-300 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-teal-300" />
              </span>
              En direct
            </p>
            <h2 id="membres" className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Ils ont déjà rejoint <span className="text-gradient">LinkProB2B</span>
            </h2>
          </div>
          <p aria-live="polite" className={`rounded-full bg-teal/15 px-3 py-1 text-sm font-semibold text-teal-200 ring-1 ring-teal/30 transition ${joined ? "opacity-100" : "opacity-0"}`}>
            Un nouveau professionnel vient de nous rejoindre
          </p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {cards.map(({ icon: Icon, value, label, plus }) => (
            <div key={label} className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur transition hover:bg-white/10">
              <Icon className="size-5 text-teal-300" aria-hidden />
              <p className="mt-3 text-gradient text-4xl font-extrabold sm:text-5xl">
                {plus ? "+" : ""}
                <CountUp value={value} />
              </p>
              <p className="mt-1 text-sm text-white/70">{label}</p>
            </div>
          ))}
        </div>
        {companies.length > 0 && (
          <div className="mt-10">
            <p className="mb-4 text-sm font-semibold text-white/70">Entreprises présentes dans l&apos;annuaire</p>
            <LogoMarquee companies={companies} />
          </div>
        )}
      </div>
    </section>
  );
}

/** Version compacte (inscription, publication) : rassure au moment de se lancer. */
export function MemberProofCompact({ initial, companies }: { initial: LiveStats; companies: MemberCompany[] }) {
  const { stats } = useLiveStats(initial);
  if (!stats.members) return null;
  const recent = recentGrowth(stats);
  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="inline-flex items-center gap-2 text-sm text-slate-600">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-teal" />
          </span>
          <span>
            <strong className="text-navy">
              <CountUp value={stats.members} />
            </strong>{" "}
            professionnels inscrits
          </span>
        </p>
        {stats.companies > 0 && (
          <p className="text-sm text-slate-600">
            <strong className="text-navy">
              <CountUp value={stats.companies} />
            </strong>{" "}
            entreprises
          </p>
        )}
        {recent && (
          <p className="text-sm font-semibold text-teal-700">
            +<CountUp value={recent.value} /> {recent.label}
          </p>
        )}
      </div>
      {companies.length > 0 && <LogoMarquee companies={companies} tone="light" />}
    </div>
  );
}
