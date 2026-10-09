import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/templates";
import { siteUrl } from "@/lib/seo";
import { generateDailyReport, parisToday, type DailyFacts, type DailySummary } from "@/lib/daily-report";

/**
 * Rapport complet de la journée, envoyé par e-mail en fin de journée (tâche du soir) :
 * analyse rédigée + tous les chiffres détaillés (audience, Outreach, collecte, référencement,
 * inscriptions, tâches automatiques). Destinataires : DAILY_REPORT_EMAIL (une ou plusieurs
 * adresses séparées par des virgules), sinon les super-administrateurs actifs.
 */

export type ReportRow = { day: string; generated_at: string; facts: unknown; summary: unknown; note: string | null; error: string | null };

const nf = new Intl.NumberFormat("fr-FR");
const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : nf.format(v));
const e = (s: string | number | null | undefined) => escapeHtml(String(s ?? "—"));
const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const NAVY = "#0F2D4A";
const h2 = (t: string) => `<h2 style="margin:28px 0 10px;font-size:17px;color:${NAVY};border-bottom:2px solid #14B8A6;padding-bottom:4px">${e(t)}</h2>`;
const p = (t: string) => `<p style="margin:0 0 10px;color:#334155;font-size:14px;line-height:21px">${e(t)}</p>`;
const muted = (t: string) => `<p style="margin:0 0 10px;color:#64748b;font-size:13px">${e(t)}</p>`;

function table(head: string[], rows: (string | number)[][], empty = "Aucune donnée aujourd'hui.") {
  if (!rows.length) return muted(empty);
  const th = head.map((h, i) => `<th style="text-align:${i ? "right" : "left"};padding:6px 8px;background:#F1F5F9;color:${NAVY};font-size:12px">${e(h)}</th>`).join("");
  const tr = rows
    .map((r) => `<tr>${r.map((c, i) => `<td style="text-align:${i ? "right" : "left"};padding:6px 8px;border-top:1px solid #E2E8F0;font-size:13px;color:#334155">${e(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 12px"><tr>${th}</tr>${tr}</table>`;
}

function tiles(items: [string, string][]) {
  const cells = items
    .map(
      ([label, value]) =>
        `<td style="padding:4px;width:33%"><div style="background:#E8F4FD;border-radius:8px;padding:10px"><div style="font-size:20px;font-weight:700;color:${NAVY}">${e(value)}</div><div style="font-size:12px;color:#475569">${e(label)}</div></div></td>`,
    )
    .reduce<string[]>((rows, cell, i) => (i % 3 === 0 ? [...rows, cell] : [...rows.slice(0, -1), rows[rows.length - 1] + cell]), [])
    .map((r) => `<tr>${r}</tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px">${cells}</table>`;
}

const bullets = (items: { label?: string; text: string }[], color: string) =>
  items.length
    ? `<ul style="margin:0 0 12px;padding-left:18px">${items.map((i) => `<li style="margin:0 0 6px;font-size:14px;line-height:20px;color:#334155">${i.label ? `<strong style="color:${color}">${e(i.label)} : </strong>` : ""}${e(i.text)}</li>`).join("")}</ul>`
    : muted("Rien à signaler.");

/** Contenu de l'e-mail (HTML + texte) à partir du bilan enregistré. */
export function renderDailyReportEmail(row: ReportRow) {
  const f = row.facts as DailyFacts;
  const s = row.summary as DailySummary | null;
  const a = f.audience.aujourdhui;
  const o = f.outreach;
  const gate = o.parcours_vers_les_offres;
  const parts: string[] = [];
  const lines: string[] = [];

  parts.push(`<h1 style="margin:0 0 6px;font-size:21px;color:${NAVY}">Rapport de la journée</h1>`);
  parts.push(muted(`${dayLabel(f.date)} — chiffres arrêtés à ${f.heure_du_bilan} (heure de Paris)`));
  lines.push(`Rapport de la journée — ${dayLabel(f.date)} (chiffres à ${f.heure_du_bilan})`, "");

  if (s) {
    parts.push(`<p style="margin:12px 0 8px;font-size:16px;font-weight:700;color:${NAVY}">${e(s.titre)}</p>`, p(s.resume));
    lines.push(s.titre, s.resume, "");
  } else {
    parts.push(muted(row.error ?? "Analyse indisponible : chiffres détaillés ci-dessous."));
  }

  const gai = f.google_articles_inscriptions ?? {
    visites_depuis_google: { aujourdhui: 0, hier: 0, sept_derniers_jours: 0, pages_d_arrivee_aujourdhui: [] },
    articles_publies_hier_et_aujourdhui: [],
    inscriptions_du_jour: { nombre: 0, venues_de_la_prospection: 0, liste: [] },
  };
  const g = gai.visites_depuis_google;
  const ins = gai.inscriptions_du_jour;
  parts.push(h2("Chiffres clés"));
  parts.push(
    tiles([
      ["Visites", n(a.visites)],
      ["Visiteurs venus de Google", n(g.aujourdhui)],
      ["Inscriptions", n(ins.nombre)],
      ["E-mails de prospection envoyés", n(o.emails_envoyes_aujourdhui)],
      ["Opportunités ajoutées", n(f.collecte.opportunites_ajoutees_aujourdhui)],
      ["Articles publiés", n(f.referencement_naturel.articles_publies_aujourdhui.length)],
    ]),
  );
  lines.push(
    `Visites : ${n(a.visites)} · Depuis Google : ${n(g.aujourdhui)} · Inscriptions : ${n(ins.nombre)}`,
    `E-mails envoyés : ${n(o.emails_envoyes_aujourdhui)} · Opportunités ajoutées : ${n(f.collecte.opportunites_ajoutees_aujourdhui)} · Articles : ${n(f.referencement_naturel.articles_publies_aujourdhui.length)}`,
    "",
  );

  // ---- Google, articles et inscriptions
  parts.push(h2("Google, articles et inscriptions"));
  parts.push(table(["Visiteurs venus de Google", "Nombre"], [["Aujourd'hui", n(g.aujourdhui)], ["Hier", n(g.hier)], ["7 derniers jours", n(g.sept_derniers_jours)]]));
  if (g.pages_d_arrivee_aujourdhui.length) parts.push(table(["Page d'arrivée depuis Google (aujourd'hui)", "Visites"], g.pages_d_arrivee_aujourdhui.map((x) => [x.page, n(x.visites)])));
  parts.push(
    table(
      ["Article publié hier ou aujourd'hui", "Vues aujourd'hui", "Vues hier", "Depuis Google"],
      gai.articles_publies_hier_et_aujourdhui.map((x) => [`${x.titre} (${x.publie})`, n(x.vues_aujourdhui), x.publie === "hier" ? n(x.vues_hier) : "—", n(x.visiteurs_depuis_google)]),
      "Aucun article publié hier ni aujourd'hui.",
    ),
  );
  parts.push(
    table(
      [`Inscriptions du jour (${n(ins.nombre)}, dont ${n(ins.venues_de_la_prospection)} via la prospection)`, "Heure"],
      ins.liste.map((u) => [`${u.nom ?? "Nom non renseigné"}${u.entreprise ? ` — ${u.entreprise}` : ""}${u.via_prospection ? " (via la prospection)" : ""}`, u.heure]),
      "Aucune inscription aujourd'hui.",
    ),
  );
  lines.push(
    `Google : ${n(g.aujourdhui)} visiteurs aujourd'hui, ${n(g.hier)} hier, ${n(g.sept_derniers_jours)} sur 7 jours.`,
    ...gai.articles_publies_hier_et_aujourdhui.map((x) => `- Article « ${x.titre} » (${x.publie}) : ${n(x.vues_aujourdhui)} vues aujourd'hui, ${n(x.visiteurs_depuis_google)} depuis Google`),
    `Inscriptions du jour : ${n(ins.nombre)} (dont ${n(ins.venues_de_la_prospection)} via la prospection)`,
    ...ins.liste.map((u) => `- ${u.heure} ${u.nom ?? "Nom non renseigné"}${u.entreprise ? ` — ${u.entreprise}` : ""}`),
    "",
  );

  if (s) {
    parts.push(h2("Ce qui a bien marché"), bullets(s.points_forts.map((x) => ({ label: x.domaine, text: x.constat })), "#0F766E"));
    parts.push(h2("Ce qui a moins marché / à surveiller"), bullets(s.points_faibles.map((x) => ({ label: x.domaine, text: x.constat })), "#B45309"));
    parts.push(h2("Ce que les tâches automatiques ont fait"), bullets(s.automatique.map((x) => ({ label: x.domaine, text: x.bilan })), NAVY));
    parts.push(h2("Recommandations pour demain"), bullets(s.recommandations.map((t) => ({ text: t })), NAVY));
    lines.push("Ce qui a bien marché :", ...s.points_forts.map((x) => `- ${x.domaine} : ${x.constat}`), "");
    lines.push("À surveiller :", ...s.points_faibles.map((x) => `- ${x.domaine} : ${x.constat}`), "");
    lines.push("Tâches automatiques :", ...s.automatique.map((x) => `- ${x.domaine} : ${x.bilan}`), "");
    lines.push("Recommandations :", ...s.recommandations.map((t) => `- ${t}`), "");
  }

  // ---- Détail
  parts.push(h2("Audience"));
  const y = f.audience.hier_journee_complete;
  const w = f.audience.moyenne_7_derniers_jours;
  parts.push(
    table(
      ["Indicateur", "Aujourd'hui", "Hier", "Moyenne 7 j"],
      [
        ["Visites", n(a.visites), n(y?.visites), n(w?.visites_par_jour)],
        ["Pages vues", n(a.pages_vues), n(y?.pages_vues), "—"],
        ["Visites depuis les moteurs", n(f.referencement_naturel.visites_depuis_les_moteurs_aujourdhui), n(y?.visites_moteurs_de_recherche), n(w?.visites_moteurs_par_jour)],
        ["Pages par visite", String(a.pages_par_visite).replace(".", ","), "—", "—"],
        ["Durée moyenne (s)", n(a.duree_moyenne_secondes), "—", "—"],
        ["Taux de rebond (%)", n(a.taux_de_rebond_pourcent), "—", "—"],
      ],
    ),
  );
  parts.push(table(["Canal d'arrivée", "Visites"], a.canaux.map((c) => [c.canal, n(c.visites)])));
  parts.push(table(["Page la plus vue", "Vues"], a.pages_les_plus_vues.map((x) => [x.page, n(x.vues)])));
  parts.push(table(["Page d'entrée", "Visites"], a.pages_d_entree.map((x) => [x.page, n(x.visites)])));
  if (a.moteurs_de_recherche.length) parts.push(muted(`Moteurs de recherche : ${a.moteurs_de_recherche.map((m) => `${m.moteur} (${n(m.visites)})`).join(" · ")}`));
  if (a.heure_la_plus_active !== null) parts.push(muted(`Heure la plus active : ${a.heure_la_plus_active} h`));
  const v = f.actions_des_visiteurs;
  parts.push(
    table(
      ["Actions des visiteurs", "Nombre"],
      [
        ["Recherches", n(v.recherches)],
        ["Intérêts manifestés", n(v.interets_manifestes)],
        ["Réponses envoyées", n(v.reponses_envoyees)],
        ["Alertes créées", n(v.alertes_creees)],
        ["Clics vers les sources", n(v.clics_vers_les_sources)],
      ],
    ),
  );
  lines.push(`Audience : ${n(a.visites)} visites (hier ${n(y?.visites)}, moyenne 7 j ${n(w?.visites_par_jour)}), ${n(a.pages_vues)} pages vues.`);
  lines.push(...a.pages_les_plus_vues.map((x) => `- ${x.page} : ${n(x.vues)} vues`), "");

  parts.push(h2("Outreach (prospection par e-mail)"));
  parts.push(muted(`Mode : ${o.mode} · limite ${n(o.limite_envois_par_jour)} e-mails par jour, ${n(o.limite_envois_par_heure)} par heure · montée en charge : ${o.montee_en_charge ?? "—"}`));
  parts.push(table(["Campagne", "Heure", "Statut", "Envoyés"], o.campagnes_du_jour.map((c) => [c.type, c.heure, c.statut, n(c.emails_envoyes)]), "Aucune campagne aujourd'hui."));
  parts.push(
    table(
      ["Étape", "Nombre"],
      [
        ["Entreprises découvertes", n(o.entreprises_decouvertes_aujourdhui)],
        ["Adresses e-mail trouvées", n(o.adresses_email_trouvees_aujourdhui)],
        ["E-mails envoyés", n(o.emails_envoyes_aujourdhui)],
        ["Ouvertures (indicatives)", n(o.ouvertures)],
        ["Clics", n(o.clics)],
        ["Sélections consultées", n(o.selections_consultees)],
        ["Page d'accès affichée", n(gate.page_d_acces_affichee)],
        ["Clics « Créer mon compte »", n(gate.clics_creer_un_compte)],
        ["Clics « Se connecter »", n(gate.clics_se_connecter)],
        ["Inscriptions venues d'Outreach", n(o.inscriptions_venues_d_outreach)],
        ["Connexions", n(gate.connexions)],
        ["Accès aux offres", n(gate.acces_aux_offres)],
        ["Désinscriptions", n(o.desinscriptions)],
        ["Adresses inexistantes (rebonds)", n(o.adresses_inexistantes_rebonds)],
        ["Échecs d'envoi", n(o.echecs_d_envoi)],
      ],
    ),
  );
  lines.push(
    `Outreach : ${n(o.emails_envoyes_aujourdhui)} envoyés, ${n(o.ouvertures)} ouvertures, ${n(o.clics)} clics, ${n(o.inscriptions_venues_d_outreach)} inscriptions, ${n(gate.acces_aux_offres)} accès aux offres, ${n(o.desinscriptions)} désinscriptions, ${n(o.adresses_inexistantes_rebonds)} rebonds.`,
    "",
  );

  parts.push(h2("Collecte des opportunités"));
  const c = f.collecte;
  parts.push(table(["Source", "Statut", "Reçues", "Nouvelles", "Mises à jour", "Erreurs"], c.sources.map((x) => [x.source, x.statut, n(x.recues), n(x.nouvelles), n(x.mises_a_jour), n(x.erreurs)]), "Aucune collecte aujourd'hui."));
  parts.push(table(["Secteur", "Nouvelles opportunités"], c.principaux_secteurs.map((x) => [x.nom, n(x.nombre)])));
  parts.push(table(["Région", "Nouvelles opportunités"], c.principales_regions.map((x) => [x.nom, n(x.nombre)])));
  lines.push(`Collecte : ${n(c.opportunites_ajoutees_aujourdhui)} opportunités ajoutées.`, ...c.sources.map((x) => `- ${x.source} : ${x.statut}, ${n(x.nouvelles)} nouvelles`), "");

  parts.push(h2("Référencement naturel et articles"));
  const r = f.referencement_naturel;
  parts.push(
    table(
      ["Indicateur", "Nombre"],
      [
        ["Visites depuis les moteurs", n(r.visites_depuis_les_moteurs_aujourdhui)],
        ["Vues des analyses", n(r.vues_des_analyses)],
        ["Vues des pages régions / secteurs", n(r.vues_des_pages_regions_secteurs)],
      ],
    ),
  );
  parts.push(r.articles_publies_aujourdhui.length ? bullets(r.articles_publies_aujourdhui.map((t) => ({ text: t })), NAVY) : muted("Aucun article publié aujourd'hui."));
  lines.push(`Référencement : ${n(r.visites_depuis_les_moteurs_aujourdhui)} visites des moteurs, ${n(r.articles_publies_aujourdhui.length)} articles publiés.`, "");

  parts.push(h2("Inscriptions et abonnements"));
  const pl = f.plateforme;
  parts.push(
    table(
      ["Indicateur", "Nombre"],
      [
        ["Nouveaux comptes", n(pl.nouveaux_comptes)],
        ["Nouvelles entreprises", n(pl.nouvelles_entreprises)],
        ["Nouveaux abonnements", n(pl.nouveaux_abonnements.length)],
      ],
    ),
  );
  if (pl.nouveaux_abonnements.length) parts.push(muted(pl.nouveaux_abonnements.map((x) => `${x.formule} (${x.statut})`).join(" · ")));
  lines.push(`Inscriptions : ${n(pl.nouveaux_comptes)} comptes, ${n(pl.nouvelles_entreprises)} entreprises, ${n(pl.nouveaux_abonnements.length)} abonnements.`, "");

  parts.push(h2("Tâches automatiques du jour"));
  const t = f.taches_automatiques;
  parts.push(table(["Passage", "Heure", "Étapes en échec"], t.passages_du_jour.map((x) => [x.passage, x.heure, x.etapes_en_echec.length ? x.etapes_en_echec.join(", ") : "aucune"]), "Aucun passage enregistré aujourd'hui."));
  lines.push("Tâches automatiques :", ...t.passages_du_jour.map((x) => `- ${x.heure} ${x.passage} : ${x.etapes_en_echec.length ? `échec ${x.etapes_en_echec.join(", ")}` : "OK"}`), "");

  if (row.note) parts.push(muted(row.note));
  const admin = `${siteUrl()}/admin`;
  parts.push(`<p style="margin:24px 0"><a href="${e(admin)}" style="background:#14B8A6;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Ouvrir le tableau de bord</a></p>`);
  lines.push(`Tableau de bord : ${admin}`);

  const footer = "Rapport envoyé automatiquement chaque soir aux administrateurs de LinkProB2B, à partir des chiffres réels de la plateforme.";
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#E8F4FD;font-family:Inter,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 8px">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px">
<tr><td style="background:${NAVY};border-radius:12px 12px 0 0;padding:18px 24px;color:#ffffff;font-weight:700;font-size:18px">LinkPro<span style="color:#14B8A6">B2B</span></td></tr>
<tr><td style="padding:24px">${parts.join("")}<p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:18px">${e(footer)}</p></td></tr></table></td></tr></table></body></html>`;
  const subject = `Rapport LinkProB2B du ${dayLabel(f.date)} — ${n(a.visites)} visites, ${n(o.emails_envoyes_aujourdhui)} e-mails envoyés, ${n(f.actions_des_visiteurs.inscriptions)} inscriptions`;
  return { subject, html, text: [...lines, "", footer].join("\n") };
}

/** Destinataires : DAILY_REPORT_EMAIL, sinon les super-administrateurs actifs. */
export async function reportRecipients(): Promise<string[]> {
  const configured = (process.env.DAILY_REPORT_EMAIL ?? "")
    .split(/[,;\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  if (configured.length) return [...new Set(configured)];
  const { data } = await createAdminClient().from("users").select("email").eq("platform_role", "SUPER_ADMIN").eq("status", "ACTIVE").eq("is_demo", false);
  return [...new Set((data ?? []).map((u) => u.email?.toLowerCase()).filter((x): x is string => Boolean(x)))];
}

/**
 * Envoie le rapport complet du jour (une seule fois par jour, sauf `force`) : le bilan est
 * d'abord recalculé avec les chiffres les plus récents (`regenerate`, par défaut). Un envoi à la
 * demande (`force`) n'empêche pas le rapport du soir : seul l'envoi du soir est enregistré.
 */
export async function sendDailyReportEmail({ force = false, regenerate = true, now = new Date() }: { force?: boolean; regenerate?: boolean; now?: Date } = {}) {
  const db = createAdminClient();
  const day = parisToday(now);
  const load = async () => (await db.from("daily_reports").select("day, generated_at, facts, summary, note, error, emailed_at").eq("day", day).maybeSingle()).data;
  let row = await load();
  if (row?.emailed_at && !force) return { sent: 0, skipped: "Rapport du jour déjà envoyé", recipients: [] as string[] };
  if (regenerate || !row) {
    await generateDailyReport(now, { final: true });
    row = await load();
  }
  if (!row) return { sent: 0, skipped: "Bilan du jour introuvable", recipients: [] as string[] };
  const to = await reportRecipients();
  if (!to.length) return { sent: 0, skipped: "Aucun destinataire (DAILY_REPORT_EMAIL ou super-administrateur)", recipients: [] as string[] };
  const msg = renderDailyReportEmail(row);
  // Envoi du soir réservé avant l'envoi : une seule fois même si la tâche est déclenchée deux fois
  if (!force) {
    const { data: claimed } = await db.from("daily_reports").update({ emailed_at: now.toISOString() }).eq("day", day).is("emailed_at", null).select("day");
    if (!claimed?.length) return { sent: 0, skipped: "Rapport du jour déjà envoyé", recipients: [] as string[] };
  }
  let sent = 0;
  const errors: string[] = [];
  for (const address of to) {
    const r = await sendEmail({ to: address, subject: msg.subject, html: msg.html, text: msg.text, idempotencyKey: `daily-report-${day}-${address}${force ? `-${now.getTime()}` : ""}` });
    if (r.status === "SENT") sent++;
    else errors.push(`${address} : ${r.error ?? r.status}`);
  }
  // Aucun envoi réussi : la réservation est levée (nouvel essai possible avec le bouton ou le lendemain)
  if (!sent && !force) await db.from("daily_reports").update({ emailed_at: null }).eq("day", day);
  return { sent, recipients: to, errors };
}
