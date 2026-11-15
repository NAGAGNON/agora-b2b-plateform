import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardCard } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { Bookmark, Eye, FolderOpen, Hammer, MessageCircleQuestion, Send, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";

export const metadata = { title: "Candidatures" };
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const nowMs = () => Date.now();

const STAGE_LABEL: Record<string, string> = {
  QUALIFIED: "À l'étude",
  INTERESTED: "Gardée pour plus tard",
  RESPONSE_PREPARING: "En préparation",
  RESPONSE_SENT: "Réponse déposée",
  DISCUSSION: "En discussion",
  NEGOTIATION: "En négociation",
  WON: "Gagnée",
  LOST: "Non retenue",
};
const KIND_LABEL: Record<string, string> = { NOTE: "Note", START: "Préparation commencée", STEP: "Étape franchie", SENT: "Réponse déposée", WON: "Marché gagné", LOST: "Non retenue" };
const ANSWER_LABEL: Record<string, string> = {
  INTERESTED: "Oui, à suivre",
  PREPARING: "Oui, me guider",
  SENT: "J'ai déjà répondu",
  NOT_FOR_ME: "Pas pour moi / retirée",
  LATER: "Plus tard",
};

/**
 * Suivi des candidatures : combien d'offres sont découvertes avec « En savoir plus », gardées, préparées,
 * déposées et gagnées ; ce que les membres font chaque jour ; questions posées à l'assistant.
 * Entreprises de démonstration et comptes de l'équipe (vos tests) exclus. Données internes, aucune action.
 */
export default async function AdminApplicationsPage(props: PageProps<"/admin/candidatures">) {
  const sp = await props.searchParams;
  await requireAdmin();
  const db = createAdminClient();
  const now = nowMs();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const since7 = new Date(now - 7 * DAY).toISOString();

  const [{ data: items }, { data: prompts }, { data: journal }, { data: questions }] = await Promise.all([
    db
      .from("pipeline_items")
      .select("stage, created_at, updated_at, updated_by, work_started_at, submitted_at, company_id, opportunity_id, companies!inner(name, is_demo)")
      .in("stage", Object.keys(STAGE_LABEL) as never)
      .eq("companies.is_demo", false)
      .order("updated_at", { ascending: false })
      .limit(2000),
    db.from("application_prompts").select("answer, reason, updated_at, user_id").gte("updated_at", since30).limit(2000),
    db.from("application_journal").select("kind, body, created_at, company_id, opportunity_id, user_id").gte("created_at", since30).order("created_at", { ascending: false }).limit(200),
    db.from("application_questions").select("question, answer, created_at, company_id, opportunity_id, user_id").order("created_at", { ascending: false }).limit(500),
  ]);

  // Entreprises de l'équipe (un membre marqué « interne », comme le propriétaire) : tests, jamais comptés
  const { data: internalUsers } = await db.from("users").select("id").eq("is_internal", true);
  const internalIds = (internalUsers ?? []).map((u) => u.id);
  const { data: internalMembers } = internalIds.length ? await db.from("company_members").select("company_id").in("user_id", internalIds) : { data: [] as { company_id: string }[] };
  const internal = new Set((internalMembers ?? []).map((m) => m.company_id));
  const rows = (items ?? []).filter((r) => !internal.has(r.company_id)).map((r) => ({ ...r, company: Array.isArray(r.companies) ? r.companies[0] : r.companies }));
  const count = (stages: string[]) => rows.filter((r) => stages.includes(r.stage)).length;
  const decided = count(["INTERESTED", "RESPONSE_PREPARING", "RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"]);
  const sent = count(["RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"]);
  const won = count(["WON"]);
  const companies = new Set(rows.map((r) => r.company_id)).size;
  const new7 = rows.filter((r) => r.created_at >= since7).length;
  // Consultées : fiches de candidature ouvertes (« En savoir plus »), sans rien enregistrer — 30 derniers jours
  const { data: views } = await db.from("analytics_events").select("user_id, properties, created_at").eq("event_name", "view_application").gte("created_at", since30).limit(5000);
  const viewed = new Set(
    (views ?? [])
      .filter((v) => v.user_id && !internalIds.includes(v.user_id))
      .map((v) => `${v.user_id}:${(v.properties as { opportunity_id?: string } | null)?.opportunity_id ?? ""}`),
  );
  const opened = rows.filter((r) => ["RESPONSE_PREPARING", "RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"].includes(r.stage));
  const working = rows.filter((r) => r.work_started_at);
  const idle = opened.filter((r) => !r.work_started_at);

  const realPrompts = (prompts ?? []).filter((p) => !internalIds.includes(p.user_id));
  const withdrawn = realPrompts.filter((p) => p.answer === "NOT_FOR_ME" && p.reason === "Retirée de mes candidatures").length;
  const answers = Object.entries(
    realPrompts.reduce<Record<string, number>>((acc, p) => {
      if (p.reason !== "Retirée de mes candidatures") acc[p.answer] = (acc[p.answer] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  // Noms des entreprises et des offres pour les tableaux
  const companyIds = [...new Set([...(journal ?? []), ...(questions ?? [])].map((j) => j.company_id))];
  const oppIds = [...new Set([...(journal ?? []), ...(questions ?? []), ...rows.slice(0, 300)].map((j) => j.opportunity_id))];
  const userIds = [...new Set((journal ?? []).map((j) => j.user_id).filter((x): x is string => Boolean(x)))];
  const [{ data: cos }, { data: opps }, { data: users }] = await Promise.all([
    companyIds.length ? db.from("companies").select("id, name, is_demo").in("id", companyIds) : Promise.resolve({ data: [] as { id: string; name: string; is_demo: boolean }[] }),
    oppIds.length ? db.from("opportunities").select("id, title").in("id", oppIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    userIds.length ? db.from("users").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const co = new Map((cos ?? []).map((c) => [c.id, c]));
  const opp = new Map((opps ?? []).map((o) => [o.id, o.title]));
  const userName = new Map((users ?? []).map((u) => [u.id, u.full_name]));
  const real = <T extends { company_id: string }>(list: T[]) => list.filter((x) => co.get(x.company_id) && !co.get(x.company_id)!.is_demo && !internal.has(x.company_id));
  const activity = real(journal ?? []);
  const asked = real(questions ?? []);
  // Par période : 24 h, 48 h, 7 jours, 30 jours (mêmes définitions que le parcours ci-dessous)
  const realViews = (views ?? []).filter((v) => v.user_id && !internalIds.includes(v.user_id));
  const PERIODS = [
    { key: "24h", label: "24 h", long: "les dernières 24 heures", since: new Date(now - DAY).toISOString() },
    { key: "48h", label: "48 h", long: "les dernières 48 heures", since: new Date(now - 2 * DAY).toISOString() },
    { key: "7j", label: "7 jours", long: "les 7 derniers jours", since: since7 },
    { key: "30j", label: "30 jours", long: "les 30 derniers jours", since: since30 },
  ];
  const OPENED = ["RESPONSE_PREPARING", "RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"];
  const SENT_STAGES = ["RESPONSE_SENT", "DISCUSSION", "NEGOTIATION", "WON", "LOST"];
  const periodStats = PERIODS.map(({ key, label, long, since }) => {
    const created = rows.filter((r) => r.created_at >= since);
    return {
      key,
      label,
      long,
      values: [
        new Set(realViews.filter((v) => v.created_at >= since).map((v) => `${v.user_id}:${(v.properties as { opportunity_id?: string } | null)?.opportunity_id ?? ""}`)).size,
        created.filter((r) => r.stage === "INTERESTED").length,
        created.filter((r) => OPENED.includes(r.stage)).length,
        rows.filter((r) => r.work_started_at && r.work_started_at >= since).length,
        rows.filter((r) => SENT_STAGES.includes(r.stage) && (r.submitted_at ?? r.updated_at) >= since.slice(0, 10)).length,
        rows.filter((r) => r.stage === "WON" && r.updated_at >= since).length,
        asked.filter((q) => q.created_at >= since).length,
        new Set([...created.map((r) => r.company_id)]).size,
      ],
    };
  });
  const period = periodStats.find((p) => p.key === (typeof sp.periode === "string" ? sp.periode : "7j")) ?? periodStats[2];
  const TILES = [
    { index: 0, label: "offre(s) consultée(s)", one: "offre consultée", many: "offres consultées", icon: Eye, color: "text-sky-300" },
    { index: 1, label: "gardée(s)", one: "gardée pour plus tard", many: "gardées pour plus tard", icon: Bookmark, color: "text-teal-200" },
    { index: 2, label: "dossier(s) ouvert(s)", one: "dossier ouvert (« Oui, je prépare »)", many: "dossiers ouverts (« Oui, je prépare »)", icon: FolderOpen, color: "text-teal-200" },
    { index: 3, label: "travail commencé", one: "avec travail réellement commencé", many: "avec travail réellement commencé", icon: Hammer, color: "text-teal-300" },
    { index: 4, label: "réponse(s) déposée(s)", one: "réponse déposée", many: "réponses déposées", icon: Send, color: "text-violet-300" },
    { index: 5, label: "marché(s) gagné(s)", one: "marché gagné", many: "marchés gagnés", icon: Trophy, color: "text-emerald-300" },
  ];
  const pl = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
  const [v0, v1, v2, v3, v4, v5] = period.values;
  const summary =
    v0 + v1 + v2 + v3 + v4 + v5 === 0
      ? "Aucune activité sur les candidatures pour l'instant sur cette période."
      : `${pl(v0, "offre consultée", "offres consultées")}, ${pl(v1, "gardée", "gardées")} pour plus tard, ${pl(v2, "dossier ouvert", "dossiers ouverts")} dont ${pl(v3, "avec un vrai travail commencé", "avec un vrai travail commencé")}, ${pl(v4, "réponse déposée", "réponses déposées")} et ${pl(v5, "marché gagné", "marchés gagnés")}.`;

  // Suivi par inscrit : chaque membre des entreprises qui ont des candidatures ou ont posé une question
  const memberCompanies = [...new Set([...rows.map((r) => r.company_id), ...asked.map((q) => q.company_id)])];
  const { data: members } = memberCompanies.length
    ? await db.from("company_members").select("user_id, company_id").in("company_id", memberCompanies)
    : { data: [] as { user_id: string; company_id: string }[] };
  const memberIds = [...new Set((members ?? []).map((m) => m.user_id))];
  const { data: people } = memberIds.length
    ? await db.from("users").select("id, full_name, email, created_at, last_seen_at, is_demo, is_internal").in("id", memberIds)
    : { data: [] as { id: string; full_name: string; email: string; created_at: string; last_seen_at: string | null; is_demo: boolean; is_internal: boolean }[] };
  const companyName = new Map(rows.map((r) => [r.company_id, r.company?.name ?? ""]));
  const perUser = (people ?? [])
    .filter((u) => !u.is_demo && !u.is_internal)
    .map((u) => {
      const cids = (members ?? []).filter((m) => m.user_id === u.id).map((m) => m.company_id);
      const mine = rows.filter((r) => cids.includes(r.company_id));
      const by = (stages: string[]) => mine.filter((r) => stages.includes(r.stage)).length;
      const qs = asked.filter((q) => q.user_id === u.id);
      const acts = activity.filter((a) => a.user_id === u.id);
      const last = [...mine.filter((r) => r.updated_by === u.id).map((r) => r.updated_at), ...qs.map((q) => q.created_at), ...acts.map((a) => a.created_at)].sort().pop() ?? null;
      return {
        id: u.id,
        name: u.full_name || u.email,
        email: u.email,
        company: cids.map((c) => companyName.get(c) || co.get(c)?.name).filter(Boolean).join(", "),
        signup: u.created_at,
        seen: u.last_seen_at,
        total: mine.length,
        study: by(["QUALIFIED"]),
        kept: by(["INTERESTED"]),
        preparing: by(["RESPONSE_PREPARING"]),
        working: mine.filter((r) => r.work_started_at).length,
        sent: by(["RESPONSE_SENT", "DISCUSSION", "NEGOTIATION"]),
        won: by(["WON"]),
        lost: by(["LOST"]),
        questions: qs.length,
        actions: acts.length,
        last,
        offers: mine.slice(0, 20),
      };
    })
    .filter((u) => u.total || u.questions)
    .sort((a, b) => (b.last ?? b.signup).localeCompare(a.last ?? a.signup));

  // 14 derniers jours (heure de Paris) : nouvelles candidatures et questions
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });
  const days = Array.from({ length: 14 }, (_, i) => dayKey(new Date(now - (13 - i) * DAY).toISOString()));
  const perDay = days.map((d) => ({ d, apps: rows.filter((r) => dayKey(r.created_at) === d).length, steps: activity.filter((a) => dayKey(a.created_at) === d).length }));
  const maxDay = Math.max(1, ...perDay.map((x) => x.apps + x.steps));

  const funnel = [
    { label: "Consultées (« En savoir plus », 30 j)", value: viewed.size },
    { label: "Gardées ou dossiers ouverts", value: decided },
    { label: "Dossiers ouverts (« Oui, je prépare »)", value: opened.length },
    { label: "Travail réellement commencé", value: working.length },
    { label: "Réponses déposées", value: sent },
    { label: "Marchés gagnés", value: won },
  ];
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Candidatures</h1>
        <p className="mt-1 text-slate-600">
          Trois niveaux bien distincts : consultée (rien n&apos;est enregistré), gardée pour plus tard, dossier ouvert (« Oui, je prépare ») puis travail réellement commencé (première action concrète), jusqu&apos;au dépôt et au résultat.
          Entreprises de démonstration exclues.
        </p>
      </div>

      {/* En bref : la période choisie, en une phrase et six grandes cartes */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy to-navy-900 p-6 text-white shadow-xl sm:p-8" data-testid="periods">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-72 animate-aurora rounded-full bg-teal/25 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-wide text-teal-200 uppercase">En bref</p>
            <h2 className="mt-1 font-heading text-2xl font-extrabold text-white">Sur {period.long}</h2>
          </div>
          <nav aria-label="Période" className="inline-flex rounded-2xl bg-white/10 p-1 ring-1 ring-white/15">
            {periodStats.map((p) => (
              <Link
                key={p.key}
                href={`/admin/candidatures?periode=${p.key}`}
                aria-current={p.key === period.key ? "page" : undefined}
                className={cn("rounded-xl px-3.5 py-2 text-sm font-semibold transition", p.key === period.key ? "bg-white text-navy shadow" : "text-white/75 hover:bg-white/10 hover:text-white")}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="relative mt-4 max-w-3xl text-lg leading-relaxed text-white/85">{summary}</p>
        <ol className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {TILES.map((t, i) => {
            const v = period.values[t.index];
            const prev = i > 0 ? period.values[TILES[i - 1].index] : null;
            return (
              <li key={t.label} className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
                <t.icon className={cn("size-5", t.color)} aria-hidden />
                <p className="mt-3 font-heading text-4xl font-extrabold tabular-nums">{v}</p>
                <p className="mt-1 text-sm leading-snug text-white/80">{v > 1 ? t.many : t.one}</p>
                {prev !== null && prev > 0 && <p className="mt-2 text-xs font-semibold text-teal-200">{Math.round((v / prev) * 100)} % de l&apos;étape avant</p>}
              </li>
            );
          })}
        </ol>
        <p className="relative mt-4 text-sm text-white/60">
          <MessageCircleQuestion className="mr-1 inline size-4 align-[-3px]" aria-hidden />
          {pl(period.values[6], "question posée", "questions posées")} à l&apos;assistant · {pl(period.values[7], "entreprise active", "entreprises actives")} · vos comptes de test ne sont jamais comptés.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DashboardCard label="Candidatures suivies" value={rows.length} hint={`${new7} nouvelle(s) sur 7 jours · ${companies} entreprise(s)`} />
                <DashboardCard label="Gardées pour plus tard" value={count(["INTERESTED"])} hint="Rappel e-mail 7 j puis 2 j avant la date limite" />
        <DashboardCard label="Dossiers ouverts" value={opened.length} hint={`« Oui, je prépare » · ${idle.length} sans action pour l'instant`} />
        <DashboardCard label="Travail commencé" value={working.length} hint="Étape, pièce, mémoire, note ou dépôt" />
        <DashboardCard label="Consultées (30 j)" value={viewed.size} hint="Fiches ouvertes sans rien enregistrer ou avant de décider" />
        <DashboardCard label="Réponses déposées" value={sent} hint={`${count(["RESPONSE_SENT", "DISCUSSION", "NEGOTIATION"])} en attente du résultat`} />
        <DashboardCard label="Gagnées / non retenues" value={`${won} / ${count(["LOST"])}`} hint={`Taux de réussite : ${pct(won, won + count(["LOST"]))}`} />
        <DashboardCard label="Retirées (30 j)" value={withdrawn} hint="« Ne m'intéresse plus »" />
        <DashboardCard label="Questions à l'assistant" value={asked.filter((q) => q.created_at >= since30).length} hint={`${asked.filter((q) => q.created_at >= since7).length} sur 7 jours`} />
      </div>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white" data-testid="per-user">
        <table className="w-full min-w-[68rem] text-sm [&_th]:whitespace-nowrap">
          <caption className="px-3 pt-3 text-left">
            <span className="font-semibold text-navy">Par inscrit</span>
            <span className="ml-2 text-slate-500">({perUser.length}) · cliquez sur un nom pour voir ses offres</span>
          </caption>
          <thead className="bg-canvas text-left text-slate-600">
            <tr>
              <th scope="col" className="min-w-[20rem] px-3 py-2">Inscrit</th>
              <th scope="col" className="px-3 py-2 text-center">Offres</th>
              <th scope="col" className="px-3 py-2 text-center">À l&apos;étude</th>
              <th scope="col" className="px-3 py-2 text-center">Gardées</th>
              <th scope="col" className="px-3 py-2 text-center">Dossiers ouverts</th>
              <th scope="col" className="px-3 py-2 text-center">Travail commencé</th>
              <th scope="col" className="px-3 py-2 text-center">Déposées</th>
              <th scope="col" className="px-3 py-2 text-center">Gagnées / perdues</th>
              <th scope="col" className="px-3 py-2 text-center">Questions</th>
              <th scope="col" className="px-3 py-2">Dernière action</th>
            </tr>
          </thead>
          <tbody>
            {perUser.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-slate-600">Aucun inscrit n&apos;a encore ouvert de candidature.</td>
              </tr>
            ) : (
              perUser.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <details>
                      <summary className="cursor-pointer list-none">
                        <span className="font-semibold text-navy hover:underline">{u.name}</span>
                        <span className="block text-xs text-slate-500">{u.email}</span>
                        <span className="block text-xs text-slate-500">
                          {u.company || "—"} · inscrit le {new Date(u.signup).toLocaleDateString("fr-FR")}
                        </span>
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {u.offers.map((r) => (
                          <li key={r.opportunity_id} className="flex items-start gap-2 text-xs">
                            <span className="rounded-full bg-teal-50 px-2 py-0.5 font-semibold whitespace-nowrap text-teal-800 ring-1 ring-teal/20">{STAGE_LABEL[r.stage] ?? r.stage}</span>
                            <Link href={`/opportunites/${r.opportunity_id}`} className="text-navy hover:underline">
                              {opp.get(r.opportunity_id) ?? "Voir l'offre"}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-navy tabular-nums">{u.total}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{u.study || "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{u.kept || "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{u.preparing || "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{u.working || "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{u.sent || "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{u.won || u.lost ? `${u.won} / ${u.lost}` : "—"}</td>
                  <td className="px-3 py-2 text-center tabular-nums">{u.questions || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{u.last ? formatDateTime(u.last) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-navy">Taux de transformation des opportunités</h2>
          <p className="mt-1 text-sm text-slate-600">
            Sur {funnel[0].value} opportunité(s) consultée(s) : chaque ligne indique le nombre et la part des consultées
            {funnel[0].value > 0 && funnel[5].value > 0 ? ` · 1 marché gagné pour ${Math.round(funnel[0].value / funnel[5].value)} consultées` : ""}.
          </p>
          <ol className="mt-4 space-y-3">
            {funnel.map((f, i) => (
              <li key={f.label}>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-700">{f.label}</span>
                  <span className="font-semibold text-navy tabular-nums">
                    {f.value}
                    {i > 0 && (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {pct(f.value, funnel[0].value)} des consultées · {pct(f.value, funnel[i - 1].value)} de l&apos;étape précédente
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-teal to-electric" style={{ width: `${funnel[0].value ? Math.max(2, Math.min(100, (f.value / funnel[0].value) * 100)) : 0}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-navy">14 derniers jours</h2>
          <div className="mt-4 flex h-32 items-end gap-1.5" role="img" aria-label="Nouvelles candidatures et étapes par jour sur 14 jours">
            {perDay.map((x) => (
              <div key={x.d} className="flex h-full flex-1 flex-col justify-end" title={`${new Date(x.d).toLocaleDateString("fr-FR")} : ${x.apps} nouvelle(s) candidature(s), ${x.steps} action(s)`}>
                {x.steps > 0 && <div className={x.apps ? "rounded-t bg-violet/70" : "rounded-t bg-violet/70"} style={{ height: `${(x.steps / maxDay) * 100}%` }} />}
                {x.apps > 0 && <div className={x.steps ? "bg-teal" : "rounded-t bg-teal"} style={{ height: `${(x.apps / maxDay) * 100}%` }} />}
                {x.apps + x.steps === 0 && <div className="h-px bg-slate-200" />}
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span>{new Date(days[0]).toLocaleDateString("fr-FR")}</span>
            <span>{new Date(days[days.length - 1]).toLocaleDateString("fr-FR")}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-teal" aria-hidden /> Nouvelles candidatures</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-violet/70" aria-hidden /> Étapes, notes et dépôts</span>
          </div>
          {answers.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-sm font-semibold text-navy">Réponses à « Cet appel d&apos;offres vous intéresse ? » (30 j)</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {answers.map(([a, n]) => (
                  <li key={a} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {ANSWER_LABEL[a] ?? a} : {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[48rem] text-sm">
          <caption className="px-3 pt-3 text-left font-semibold text-navy">Dernières candidatures</caption>
          <thead className="bg-canvas text-left text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">Mise à jour</th>
              <th scope="col" className="px-3 py-2">Entreprise</th>
              <th scope="col" className="px-3 py-2">Offre</th>
              <th scope="col" className="px-3 py-2">Où en est-elle</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-slate-600">Aucune candidature pour l&apos;instant.</td>
              </tr>
            ) : (
              rows.slice(0, 50).map((r) => (
                <tr key={`${r.company_id}-${r.opportunity_id}`} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDateTime(r.updated_at)}</td>
                  <td className="px-3 py-2 font-medium text-navy">{r.company?.name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/opportunites/${r.opportunity_id}`} className="text-navy hover:underline">
                      {opp.get(r.opportunity_id) ?? "Voir l'offre"}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-teal-800 ring-1 ring-teal/20">{STAGE_LABEL[r.stage] ?? r.stage}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[48rem] text-sm">
          <caption className="px-3 pt-3 text-left font-semibold text-navy">Activité jour par jour (30 jours)</caption>
          <thead className="bg-canvas text-left text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">Date</th>
              <th scope="col" className="px-3 py-2">Qui</th>
              <th scope="col" className="px-3 py-2">Offre</th>
              <th scope="col" className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {activity.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-slate-600">Aucune activité sur 30 jours.</td>
              </tr>
            ) : (
              activity.slice(0, 100).map((a, i) => (
                <tr key={i} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDateTime(a.created_at)}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-navy">{co.get(a.company_id)?.name ?? "—"}</p>
                    {a.user_id && userName.get(a.user_id) && <p className="text-xs text-slate-500">{userName.get(a.user_id)}</p>}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{opp.get(a.opportunity_id) ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-semibold text-navy">{KIND_LABEL[a.kind] ?? a.kind}</span>
                    {a.kind !== "NOTE" && <p className="mt-1 text-xs text-slate-500">{a.body}</p>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-navy">Dernières questions posées à l&apos;assistant</h2>
        <p className="mt-1 text-sm text-slate-600">Pour vérifier la qualité des réponses et repérer les besoins fréquents.</p>
        {asked.length === 0 ? (
          <p className="mt-4 text-slate-600">Aucune question pour l&apos;instant.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {asked.slice(0, 50).map((q, i) => (
              <li key={i} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs text-slate-500">
                  {formatDateTime(q.created_at)} · {co.get(q.company_id)?.name} · {opp.get(q.opportunity_id) ?? "offre"}
                </p>
                <p className="mt-1 font-semibold text-navy">{q.question}</p>
                <details className="mt-1">
                  <summary className="cursor-pointer text-sm text-teal-800">Voir la réponse</summary>
                  <p className="mt-2 text-sm whitespace-pre-line text-slate-700">{q.answer}</p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
