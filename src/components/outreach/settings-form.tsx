"use client";

import { ActionForm } from "@/components/admin/action-form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Checkbox, Input, Label, Textarea } from "@/components/ui/form";
import { saveOutreachSettings } from "@/app/actions/outreach";
import type { Database } from "@/lib/database.types";

type S = Database["public"]["Tables"]["outreach_settings"]["Row"];

function NumberField({ name, label, value, min, max, hint }: { name: keyof S; label: string; value: number; min: number; max: number; hint?: string }) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" min={min} max={max} defaultValue={value} required />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function OutreachSettingsForm({ s }: { s: S }) {
  return (
    <ActionForm action={saveOutreachSettings} hidden={{}} className="space-y-8">
      <section>
        <h3 className="mb-3 font-bold text-navy">Pertinence</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <NumberField name="min_score" label="Score minimum (/100)" value={s.min_score} min={0} max={100} hint="Seules les entreprises au-dessus de ce score sont proposées. Recommandé : 70." />
          <NumberField name="max_opportunities_per_email" label="Opportunités max. par e-mail" value={s.max_opportunities_per_email} min={1} max={20} />
          <NumberField name="max_prospects_per_opportunity" label="Entreprises analysées max. par opportunité" value={s.max_prospects_per_opportunity} min={1} max={5000} />
          <NumberField name="min_days_before_deadline" label="Jours minimum avant la date limite" value={s.min_days_before_deadline} min={0} max={60} hint="En dessous, l'opportunité n'est pas proposée (pas le temps de répondre)." />
          <NumberField name="lookback_days" label="Fenêtre de détection (jours)" value={s.lookback_days} min={1} max={30} hint="Opportunités publiées depuis N jours considérées comme nouvelles." />
        </div>
      </section>
      <section>
        <h3 className="mb-3 font-bold text-navy">Sur-sollicitation</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <NumberField name="min_days_between_contacts" label="Délai minimum entre deux e-mails (jours)" value={s.min_days_between_contacts} min={0} max={365} />
          <NumberField name="max_contacts_per_30_days" label="E-mails max. par entreprise sur 30 jours" value={s.max_contacts_per_30_days} min={1} max={30} />
          <NumberField name="daily_send_cap" label="Envois max. par jour (campagne automatique)" value={s.daily_send_cap} min={0} max={10000} />
        </div>
      </section>
      <section>
        <h3 className="mb-1 font-bold text-navy">Envoi progressif (réputation du domaine)</h3>
        <p className="mb-3 text-sm text-slate-600">
          Les e-mails partent un par un depuis la file d&apos;attente. Commencez bas et augmentez par paliers (par exemple +25 % par semaine) tant que les rebonds et
          plaintes restent faibles.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NumberField name="total_daily_send_cap" label="Envois max. par jour (toutes campagnes)" value={s.total_daily_send_cap} min={0} max={10000} hint="Campagnes automatiques et manuelles confondues." />
          <NumberField name="hourly_send_cap" label="Envois max. par heure" value={s.hourly_send_cap} min={0} max={2000} hint="Respectez la limite de votre messagerie." />
          <NumberField name="send_interval_seconds" label="Intervalle entre deux e-mails (secondes)" value={s.send_interval_seconds} min={0} max={300} />
          <NumberField name="max_send_attempts" label="Tentatives max. par e-mail" value={s.max_send_attempts} min={1} max={10} hint="En cas d'erreur temporaire du serveur." />
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="font-bold text-navy">Automatisation</h3>
        <Checkbox name="dry_run" defaultChecked={s.dry_run} label="Mode simulation (dry-run)" hint="Tout est préparé et suivi, mais aucun e-mail réel n'est envoyé." />
        <Checkbox name="require_validation" defaultChecked={s.require_validation} label="Validation manuelle de chaque campagne" hint="Décochez pour un fonctionnement entièrement automatique (la campagne du jour part après sa préparation)." />
        <Checkbox name="discovery_enabled" defaultChecked={s.discovery_enabled} label="Découverte automatique d'entreprises (registre public SIRENE)" hint="Ajoute les entreprises actives des métiers concernés dans le département de chaque opportunité. Cette source ne fournit pas d'e-mail." />
        <Checkbox
          name="enrichment_enabled"
          defaultChecked={s.enrichment_enabled}
          label="Recherche automatique des adresses e-mail"
          hint="Site officiel (Brave Search ou Dropcontact), puis adresse générique (contact@, info@…) publiée sur la page Contact. Jamais d'adresse nominative ; robots.txt respecté."
        />
        <div className="max-w-xs">
          <NumberField name="enrichment_daily_limit" label="Entreprises analysées par jour (recherche d'e-mail)" value={s.enrichment_daily_limit} min={0} max={50000} hint="Chaque entreprise analysée consomme une requête de votre forfait Brave Search ou Dropcontact." />
        </div>
        <Checkbox name="include_individual_entrepreneurs" defaultChecked={s.include_individual_entrepreneurs} label="Inclure les entrepreneurs individuels" hint="Désactivé par défaut : leurs coordonnées sont des données personnelles (RGPD)." />
      </section>
      <section>
        <h3 className="mb-3 font-bold text-navy">E-mail</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="sender_name">Nom de l&apos;expéditeur</Label>
            <Input id="sender_name" name="sender_name" defaultValue={s.sender_name} required maxLength={120} />
          </div>
          <div>
            <Label htmlFor="reply_to">Adresse de réponse</Label>
            <Input id="reply_to" name="reply_to" type="email" defaultValue={s.reply_to ?? ""} placeholder="contact@linkprob2b.com" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="subject_template">Modèle d&apos;objet</Label>
            <Input id="subject_template" name="subject_template" defaultValue={s.subject_template} required maxLength={200} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="intro_template">Modèle d&apos;introduction</Label>
            <Textarea id="intro_template" name="intro_template" defaultValue={s.intro_template} rows={3} required maxLength={1000} />
            <p className="mt-1 text-xs text-slate-500">
              Variables : {"{entreprise}"} · {"{nombre_opportunites}"} · {"{secteur}"} · {"{secteur_phrase}"} · {"{zone}"} · {"{zone_phrase}"} · {"{s}"} et {"{ent}"} (pluriel).
            </p>
          </div>
        </div>
      </section>
      <SubmitButton pendingLabel="Enregistrement…">Enregistrer les paramètres</SubmitButton>
    </ActionForm>
  );
}
