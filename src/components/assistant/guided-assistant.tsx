"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, FileText, MessageCircleQuestion, Search, X } from "lucide-react";
import { assistantPreview, assistantSetup, type AssistantPreview, type AssistantSetup } from "@/app/actions/assistant";
import { AlertLeadForm } from "@/components/alert-lead-form";

/** Espaces où l'assistant n'apparaît pas (tableaux de bord, formulaires d'accès). */
const HIDDEN = ["/dashboard", "/admin", "/outreach", "/inscription", "/connexion", "/mot-de-passe-oublie", "/reinitialiser-mot-de-passe", "/onboarding"];

type Goal = "marches" | "fournisseur";
type Step = "goal" | "sector" | "region" | "result";

/**
 * Assistant guidé : trois questions (objectif, métier, zone), puis les opportunités ouvertes
 * correspondantes (nombre réel), l'accès à la liste et l'alerte par e-mail.
 */
export function GuidedAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("goal");
  const [goal, setGoal] = useState<Goal>("marches");
  const [setup, setSetup] = useState<AssistantSetup | null>(null);
  const [family, setFamily] = useState<string | null>(null);
  const [sector, setSector] = useState<{ slug: string; label: string } | null>(null);
  const [region, setRegion] = useState<{ slug: string; name: string } | null>(null);
  const [preview, setPreview] = useState<AssistantPreview | null>(null);
  const [pending, start] = useTransition();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("button, a, input, select")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  if (HIDDEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const openPanel = () => {
    setOpen(true);
    if (!setup) start(async () => setSetup(await assistantSetup()));
  };
  const chooseGoal = (g: Goal) => {
    setGoal(g);
    setStep("sector");
  };
  const chooseSector = (s: { slug: string; label: string }) => {
    setSector(s);
    if (goal === "fournisseur") setStep("result");
    else setStep("region");
  };
  const chooseRegion = (r: { slug: string; name: string } | null) => {
    setRegion(r);
    setStep("result");
    setPreview(null);
    start(async () => setPreview(await assistantPreview(sector?.slug ?? null, r?.slug ?? null)));
  };
  const back = () => {
    if (step === "result") setStep(goal === "fournisseur" ? "sector" : "region");
    else if (step === "region") setStep("sector");
    else if (step === "sector") {
      if (family) setFamily(null);
      else setStep("goal");
    }
  };
  const restart = () => {
    setStep("goal");
    setFamily(null);
    setSector(null);
    setRegion(null);
    setPreview(null);
  };

  const listQuery = new URLSearchParams({ ...(sector ? { secteur: sector.slug } : {}), ...(region ? { region: region.slug } : {}) }).toString();
  const listHref = `/opportunites${listQuery ? `?${listQuery}` : ""}`;
  const zone = region ? region.name : "France entière";
  const option =
    "group flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-navy transition hover:border-teal hover:bg-teal-50";

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-labelledby={titleId}
          className="flex max-h-[min(36rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2rem))] animate-pop flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
          data-testid="assistant"
        >
          <div className="flex items-center gap-3 bg-gradient-to-r from-navy-900 to-petrol px-4 py-3 text-white">
            {step !== "goal" && (
              <button type="button" onClick={back} className="rounded-lg p-1 hover:bg-white/10" aria-label="Étape précédente">
                <ArrowLeft className="size-5" aria-hidden />
              </button>
            )}
            <p id={titleId} className="flex-1 font-heading font-bold">
              Assistant LinkProB2B
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                toggle.current?.focus();
              }}
              className="rounded-lg p-1 hover:bg-white/10"
              aria-label="Fermer l'assistant"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4" aria-live="polite">
            {step === "goal" && (
              <>
                <p className="text-sm text-slate-700">Bonjour ! En trois questions, je vous montre ce qui vous correspond. Que cherchez-vous ?</p>
                <div className="mt-4 space-y-2">
                  <button type="button" className={option} onClick={() => chooseGoal("marches")}>
                    <span className="flex items-center gap-2">
                      <Search className="size-4 text-teal-700" aria-hidden /> Des marchés et des clients
                    </span>
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </button>
                  <button type="button" className={option} onClick={() => chooseGoal("fournisseur")}>
                    <span className="flex items-center gap-2">
                      <Building2 className="size-4 text-teal-700" aria-hidden /> Un fournisseur ou un prestataire
                    </span>
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </button>
                  <Link href="/publier" className={option} onClick={() => setOpen(false)}>
                    <span className="flex items-center gap-2">
                      <FileText className="size-4 text-teal-700" aria-hidden /> Publier un besoin (devis, consultation)
                    </span>
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </div>
              </>
            )}

            {step === "sector" && (
              <>
                <p className="text-sm text-slate-700">{goal === "marches" ? "Quel est votre métier ?" : "Dans quel domaine cherchez-vous ?"}</p>
                {!setup ? (
                  <p className="mt-4 text-sm text-slate-500">Chargement…</p>
                ) : !family ? (
                  <div className="mt-4 space-y-2">
                    {setup.families.map((f) => (
                      <button key={f.slug} type="button" className={option} onClick={() => setFamily(f.slug)}>
                        {f.label}
                        <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {setup.families
                      .find((f) => f.slug === family)
                      ?.sectors.map((s) => (
                        <button key={s.slug} type="button" className={option} onClick={() => chooseSector(s)}>
                          {s.label}
                          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                        </button>
                      ))}
                  </div>
                )}
              </>
            )}

            {step === "region" && setup && (
              <>
                <p className="text-sm text-slate-700">Où intervenez-vous ?</p>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  <button type="button" className={option} onClick={() => chooseRegion(null)}>
                    France entière
                    <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </button>
                  {setup.regions.map((r) => (
                    <button key={r.slug} type="button" className={option} onClick={() => chooseRegion(r)}>
                      {r.name}
                      <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === "result" && goal === "fournisseur" && sector && (
              <>
                <p className="text-sm text-slate-700">
                  Voici les entreprises référencées en <strong>{sector.label}</strong>. Vous pouvez aussi publier votre besoin : nous le présentons aux
                  entreprises du bon métier et de la bonne zone.
                </p>
                <div className="mt-4 space-y-2">
                  <Link href={`/entreprises?secteur=${sector.slug}`} className={option} onClick={() => setOpen(false)}>
                    Voir les entreprises
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                  <Link href="/publier" className={option} onClick={() => setOpen(false)}>
                    Publier mon besoin gratuitement
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </>
            )}

            {step === "result" && goal === "marches" && sector && (
              <>
                {pending || !preview ? (
                  <p className="text-sm text-slate-500">Recherche des opportunités…</p>
                ) : !preview.ok ? (
                  <p className="text-sm text-slate-700">La recherche n&apos;a pas abouti. Consultez directement la liste des opportunités.</p>
                ) : (
                  <>
                    <p className="text-sm text-slate-700">
                      <strong className="font-heading text-2xl text-navy">{preview.total.toLocaleString("fr-FR")}</strong>{" "}
                      opportunité{preview.total > 1 ? "s" : ""} ouverte{preview.total > 1 ? "s" : ""} en <strong>{sector.label}</strong> ({zone}).
                    </p>
                    {preview.items.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {preview.items.map((o) => (
                          <li key={o.id}>
                            <Link
                              href={`/opportunites/${o.id}`}
                              onClick={() => setOpen(false)}
                              className="block rounded-xl border border-slate-200 p-3 text-sm transition hover:border-teal hover:bg-teal-50"
                            >
                              <span className="line-clamp-2 font-semibold text-navy">{o.title}</span>
                              {o.by && <span className="mt-0.5 block truncate text-xs text-slate-600">{o.by}</span>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                <Link
                  href={listHref}
                  onClick={() => setOpen(false)}
                  className="btn-shine mt-4 flex h-11 items-center justify-center gap-2 rounded-lg bg-teal text-sm font-semibold text-navy hover:bg-teal-400"
                >
                  Voir toutes les opportunités <ArrowRight className="size-4" aria-hidden />
                </Link>
                <div className="mt-4">
                  <AlertLeadForm
                    compact
                    title="Recevoir les nouvelles par e-mail"
                    label={`${sector.label} — ${zone}`}
                    sector={sector.slug}
                    department={null}
                    region={region?.slug ?? null}
                    path={listHref}
                  />
                </div>
                <button type="button" onClick={restart} className="mt-3 text-sm font-medium text-teal-700 hover:underline">
                  Recommencer
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <button
        ref={toggle}
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-expanded={open}
        className="group relative isolate flex items-center gap-2 rounded-full bg-navy p-3 sm:px-4 font-semibold text-white shadow-xl shadow-navy/30 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-navy-700"
      >
        {!open && <span aria-hidden className="absolute inset-0 -z-10 animate-ping rounded-full bg-teal/40 [animation-duration:2.5s] motion-reduce:animate-none" />}
        {open ? <X className="size-5" aria-hidden /> : <MessageCircleQuestion className="size-5 text-teal" aria-hidden />}
        <span className={open ? "sr-only" : "sr-only text-sm sm:not-sr-only"}>{open ? "Fermer l'assistant" : "Besoin d'aide ?"}</span>
      </button>
    </div>
  );
}
