import Link from "next/link";
import {
  ArrowRight,
  Building2,
  FileSearch,
  Handshake,
  Landmark,
  MapPinned,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";
import { CompanyLogo } from "@/components/companies/company-logo";
import { CountUp } from "@/components/home/count-up";
import type { PlatformStats, PublicActivity } from "@/lib/queries/platform";

/** Nouveaux membres de la semaine : affichés seulement à partir de ce seuil (jamais un petit chiffre en vitrine). */
const MIN_WEEKLY_MEMBERS = 10;

type Event =
  | {
      kind: "need";
      at: string;
      id: string;
      title: string;
      who: string;
      city: string | null;
    }
  | {
      kind: "joined";
      at: string;
      slug: string;
      name: string;
      city: string | null;
      logo_path: string | null;
    };

/** « aujourd'hui », « hier », « il y a 3 jours »… (heure du serveur, page régénérée régulièrement). */
function ago(at: string, now: number) {
  const days = Math.floor((now - new Date(at).getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  if (days < 14) return "la semaine dernière";
  return `il y a ${Math.floor(days / 7)} semaines`;
}

function events(activity: PublicActivity | null): Event[] {
  if (!activity) return [];
  // Les besoins publiés passent avant les arrivées dans l'annuaire (jusqu'à 3), le reste complète
  const needs = activity.needs.slice(0, 3);
  const list: Event[] = [
    ...needs.map((n) => ({
      kind: "need" as const,
      at: n.at,
      id: n.id,
      title: n.title,
      who: n.company,
      city: n.city,
    })),
    ...activity.joined
      .slice(0, 6 - needs.length)
      .map((c) => ({
        kind: "joined" as const,
        at: c.at,
        slug: c.slug,
        name: c.name,
        city: c.city,
        logo_path: c.logo_path,
      })),
  ];
  return list.sort((a, b) => b.at.localeCompare(a.at));
}

const serverNow = () => Date.now();

/**
 * Preuve sociale de l'accueil : ce que la plateforme apporte réellement (appels d'offres ouverts,
 * acheteurs publics, nouveautés du jour, couverture), sources officielles, et l'activité récente
 * des entreprises inscrites (besoins publiés, arrivées dans l'annuaire). Uniquement des données
 * réelles et publiques ; un chiffre trop petit n'est pas affiché.
 */
export function PlatformProof({
  stats,
  activity,
}: {
  stats: PlatformStats | null;
  activity: PublicActivity | null;
}) {
  if (!stats?.active) return null;
  const now = serverNow();
  const feed = events(activity);
  const weekly =
    (stats.members_7d ?? 0) >= MIN_WEEKLY_MEMBERS ? (stats.members_7d ?? 0) : 0;
  const cards = [
    {
      icon: FileSearch,
      value: stats.active,
      label: "appels d'offres et besoins ouverts",
    },
    {
      icon: Landmark,
      value: activity?.buyers ?? 0,
      label: "acheteurs publics avec un marché ouvert",
    },
    {
      icon: Sparkles,
      value: stats.new_24h || stats.new_7d,
      label: stats.new_24h
        ? "nouvelles opportunités en 24 h"
        : "nouvelles opportunités cette semaine",
      plus: true,
    },
    {
      icon: MapPinned,
      value: stats.departments,
      label: "départements couverts",
    },
  ].filter((c) => c.value > 0);

  return (
    <section
      aria-labelledby="preuve"
      className="relative isolate overflow-hidden bg-navy-900 py-14 text-white sm:py-16"
      data-testid="platform-proof"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-tech-grid absolute inset-0 opacity-60" />
        <div className="absolute -top-32 left-1/4 size-96 animate-aurora rounded-full bg-teal/20 blur-3xl" />
        <div className="absolute right-0 -bottom-40 size-96 animate-aurora rounded-full bg-violet/20 blur-3xl [animation-delay:-8s]" />
      </div>
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-teal-300">
              <span className="relative flex size-2.5" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-300 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-teal-300" />
              </span>
              En direct
            </p>
            <h2
              id="preuve"
              className="mt-2 text-2xl font-bold text-white sm:text-3xl"
            >
              Une plateforme qui{" "}
              <span className="text-gradient">bouge chaque jour</span>
            </h2>
            <p className="mt-2 text-white/70">
              Chiffres réels, mis à jour automatiquement à partir des
              publications officielles et des entreprises inscrites.
            </p>
          </div>
          {stats.sources.length > 0 && (
            <p className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm text-white/80 ring-1 ring-white/15">
              <ShieldCheck className="size-4 text-teal-300" aria-hidden />{" "}
              Sources officielles : {stats.sources.join(" · ")}
            </p>
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {cards.map(({ icon: Icon, value, label, plus }) => (
            <div
              key={label}
              className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 transition hover:bg-white/10"
            >
              <Icon className="size-5 text-teal-300" aria-hidden />
              <p className="text-gradient mt-3 text-3xl font-extrabold sm:text-5xl">
                {plus ? "+" : ""}
                <CountUp value={value} />
              </p>
              <p className="mt-1 text-sm text-white/70">{label}</p>
            </div>
          ))}
        </div>

        {(feed.length > 0 || weekly > 0) && (
          <div className="mt-10 rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/10 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-white">
                Activité récente des entreprises
              </h3>
              {weekly > 0 && (
                <p className="inline-flex items-center gap-2 rounded-full bg-teal/15 px-3 py-1 text-sm font-semibold text-teal-200 ring-1 ring-teal/30">
                  <UserRoundPlus className="size-4" aria-hidden /> +{weekly}{" "}
                  professionnels inscrits cette semaine
                </p>
              )}
            </div>
            {feed.length > 0 && (
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {feed.map((e) => (
                  <li
                    key={e.kind === "need" ? `n-${e.id}` : `j-${e.slug}`}
                    className="min-w-0"
                  >
                    <Link
                      href={
                        e.kind === "need"
                          ? `/opportunites/${e.id}`
                          : `/entreprises/${e.slug}`
                      }
                      className="group flex h-full min-w-0 items-start gap-3 rounded-2xl p-3 transition hover:bg-white/5"
                    >
                      {e.kind === "need" ? (
                        <span
                          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal/15 text-teal-300 ring-1 ring-teal/30"
                          aria-hidden
                        >
                          <Handshake className="size-5" />
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-xl bg-white p-0.5">
                          <CompanyLogo
                            name={e.name}
                            path={e.logo_path}
                            size={36}
                          />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block text-white/90">
                          {e.kind === "need" ? (
                            <>
                              <strong className="font-semibold text-white">
                                {e.who}
                              </strong>{" "}
                              cherche un prestataire
                            </>
                          ) : (
                            <>
                              <strong className="font-semibold text-white">
                                {e.name}
                              </strong>{" "}
                              a rejoint l&apos;annuaire
                            </>
                          )}
                        </span>
                        {e.kind === "need" && (
                          <span className="mt-0.5 line-clamp-1 [overflow-wrap:anywhere] text-teal-200 group-hover:underline">
                            « {e.title} »
                          </span>
                        )}
                        <span className="mt-0.5 block text-xs text-white/55">
                          {e.city ? `${e.city} · ` : ""}
                          {ago(e.at, now)}
                        </span>
                      </span>
                      {e.kind === "need" ? (
                        <ArrowRight
                          className="mt-1 size-4 shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-teal-300"
                          aria-hidden
                        />
                      ) : (
                        <Building2
                          className="mt-1 size-4 shrink-0 text-white/30"
                          aria-hidden
                        />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
