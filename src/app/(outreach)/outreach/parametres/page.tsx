import { CheckCircle2, XCircle } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSettings, realSendBlockers, senderLines } from "@/lib/outreach/data";
import { legalIncomplete } from "@/lib/legal";
import { PageHead, Panel } from "@/components/outreach/ui";
import { OutreachSettingsForm } from "@/components/outreach/settings-form";

export const metadata = { title: "Paramètres" };

export default async function OutreachSettingsPage() {
  // L'accès est déjà réservé aux administrateurs par le gabarit (requireAdmin).
  const s = await loadSettings(createAdminClient());
  const checks = [
    { ok: !s.dry_run, label: "Mode simulation désactivé", hint: "Paramètres ci-dessous." },
    { ok: process.env.OUTREACH_SEND_ENABLED === "true", label: "Envoi réel autorisé sur le serveur", hint: "Variable d'environnement OUTREACH_SEND_ENABLED=true (Vercel)." },
    { ok: Boolean(process.env.RESEND_API_KEY), label: "Fournisseur d'e-mails configuré", hint: "RESEND_API_KEY (déjà utilisé par LinkProB2B)." },
    { ok: Boolean(process.env.OUTREACH_EMAIL_FROM), label: "Adresse d'expédition dédiée", hint: "OUTREACH_EMAIL_FROM, ex. « LinkProB2B Veille <veille@linkprob2b.com> » (recommandé ; à défaut veille@<domaine>)." },
    { ok: !legalIncomplete(), label: "Identification complète de l'expéditeur", hint: "Dénomination, forme juridique, adresse, SIRET, contact : à renseigner dans les mentions légales." },
  ];
  const blockers = realSendBlockers(s);
  return (
    <>
      <PageHead title="Paramètres" description="Pertinence, fréquence, automatisation et contenu des e-mails." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel title="Configuration">
          <OutreachSettingsForm s={s} />
        </Panel>
        <div className="space-y-6">
          <Panel title="Envoi réel" description={blockers.length ? "Bloqué tant que tous les points ne sont pas validés." : "Tous les garde-fous sont validés."}>
            <ul className="space-y-3 text-sm">
              {checks.map((c) => (
                <li key={c.label} className="flex gap-2">
                  {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-600" aria-label="Validé" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-label="À faire" />}
                  <span>
                    <span className="font-semibold text-navy">{c.label}</span>
                    <span className="block text-xs text-slate-500">{c.hint}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Identification de l'expéditeur" description="Pied de page de chaque e-mail.">
            <p className="text-sm whitespace-pre-line text-slate-700">{senderLines().join("\n")}</p>
          </Panel>
          <Panel title="Conformité">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
              <li>Prospection B2B : message en lien avec l&apos;activité professionnelle du destinataire, expéditeur identifié, désinscription simple (lien et désinscription en un clic).</li>
              <li>Liste globale « Ne plus contacter » appliquée à chaque campagne ; entreprises déjà inscrites exclues.</li>
              <li>Origine des données conservée sur chaque fiche et rappelée dans l&apos;e-mail.</li>
              <li>Sources : registre public SIRENE (Licence Ouverte), fichiers importés d&apos;origine déclarée, saisie manuelle. Aucune collecte automatisée de sites, aucun contournement de protection.</li>
              <li>Fréquence limitée et regroupement : une entreprise reçoit au plus un e-mail par campagne.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
