import { Eye, MessageSquare, Send, Share2, Users } from "lucide-react";
import { Card, CardHeader, DashboardCard } from "@/components/ui/card";
import { ShareLinks } from "@/components/share-links";
import type { NeedMetrics } from "@/lib/needs";

/**
 * Espace de l'entreprise qui a publié un besoin : ce que LinkProB2B a réellement fait pour le faire
 * connaître (chiffres enregistrés uniquement) et liens de partage prêts à l'emploi.
 */
export function NeedVisibility({ id, title, url, m, analyzed }: { id: string; title: string; url: string; m: NeedMetrics; analyzed: boolean }) {
  const contacted = m.membersNotified + m.emailsSent;
  return (
    <Card data-testid="need-visibility">
      <CardHeader
        title="Visibilité et mise en relation"
        description={
          analyzed
            ? `Votre besoin a été analysé et proposé aux entreprises dont l'activité correspond${contacted ? ` : ${contacted} entreprise(s) prévenue(s) à ce jour` : " ; les premiers envois sont en cours"}. Chiffres réels, mis à jour en continu.`
            : "Votre besoin sera analysé et proposé aux entreprises dont l'activité correspond dans les prochaines heures."
        }
      />
      <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-5">
        <DashboardCard label="Vues de la fiche" value={m.views} icon={<Eye className="size-5" aria-hidden />} />
        <DashboardCard label="Clics « Envoyer un message »" value={m.messageClicks} icon={<MessageSquare className="size-5" aria-hidden />} />
        <DashboardCard label="Entreprises inscrites prévenues" value={m.membersNotified} icon={<Users className="size-5" aria-hidden />} />
        <DashboardCard label="Entreprises contactées par e-mail" value={m.emailsSent} icon={<Send className="size-5" aria-hidden />} />
        <DashboardCard label="Partages" value={m.shareClicks} icon={<Share2 className="size-5" aria-hidden />} />
      </div>
      <div className="border-t border-slate-100 p-5">
        <ShareLinks url={url} title={title} needId={id} label="Partagez-le aussi à votre réseau : chaque partage augmente les chances de trouver le bon prestataire" />
        <p className="mt-3 text-xs text-slate-500">
          Texte suggéré pour LinkedIn : « Nous recherchons un prestataire pour : {title}. Détails et contact sur LinkProB2B : {url} »
        </p>
      </div>
    </Card>
  );
}
