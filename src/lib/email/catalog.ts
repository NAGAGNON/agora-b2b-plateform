import "server-only";
import { env } from "@/lib/env";
import { AUTH_SUBJECTS, recoveryLayout, signupLayout, welcomeLayout } from "@/lib/email/auth-emails";
import { notificationLayout, type NotificationPayload } from "@/lib/email/outbox";
import type { renderEmail } from "@/lib/email/templates";

type Entry = { key: string; label: string; trigger: string; subject: string; layout: Parameters<typeof renderEmail>[0] };

/** Tous les e-mails envoyés par la plateforme, avec un contenu d'exemple (aperçu en administration). */
export function emailCatalog(): Entry[] {
  const link = `${env.siteUrl}/auth/confirmation?token_hash=EXEMPLE&type=signup`;
  const n = (key: string, label: string, trigger: string, p: NotificationPayload): Entry => ({
    key, label, trigger, subject: p.title ?? label, layout: notificationLayout(key, { type: key, ...p }, p.title ?? label),
  });
  return [
    { key: "auth_confirm_signup", label: "Vérification de l'adresse e-mail", trigger: "Inscription", subject: AUTH_SUBJECTS.signup, layout: signupLayout(link) },
    { key: "welcome", label: "Bienvenue", trigger: "Adresse confirmée", subject: AUTH_SUBJECTS.welcome, layout: welcomeLayout() },
    { key: "auth_recovery", label: "Récupération du mot de passe", trigger: "Mot de passe oublié", subject: AUTH_SUBJECTS.recovery, layout: recoveryLayout(link.replace("signup", "recovery")) },
    n("opportunity_published", "Publication validée", "Modération : approbation", { title: "Votre besoin est publié", body: "« Maintenance préventive de deux compresseurs » est visible des fournisseurs.", link: "/dashboard/opportunites/exemple" }),
    n("opportunity_changes_requested", "Modifications demandées", "Modération : demande de modification", { title: "Modifications demandées sur votre publication", body: "Motif : précisez le périmètre et la date limite.", link: "/dashboard/opportunites/exemple" }),
    n("opportunity_rejected", "Publication refusée", "Modération : refus", { title: "Publication refusée", body: "Motif : contenu sans lien avec une demande professionnelle.", link: "/dashboard/opportunites/exemple" }),
    n("moderation_pending", "Nouvelle opportunité à valider", "Soumission d'un besoin (équipe de modération)", { title: "Nouvelle opportunité à valider", body: "Maintenance préventive de deux compresseurs", link: "/admin/moderation" }),
    n("interest_received", "Intérêt reçu", "Un fournisseur se déclare intéressé", { title: "Nouvelle manifestation d'intérêt", body: "Une entreprise est intéressée par votre besoin.", link: "/dashboard/opportunites/exemple?onglet=interesses" }),
    n("proposal_received", "Réponse reçue", "Un fournisseur dépose une réponse", { title: "Nouvelle réponse reçue", body: "Une réponse a été déposée sur votre consultation.", link: "/dashboard/opportunites/exemple?onglet=reponses" }),
    n("new_message", "Nouveau message", "Message dans une conversation", { title: "Nouveau message de Entreprise exemple", body: "Bonjour, pouvez-vous préciser le délai d'intervention ?", link: "/dashboard/messages/exemple" }),
    n("proposal_status", "Sélection / décision", "Le demandeur présélectionne, retient ou décline une réponse", { title: "Votre réponse a été retenue", body: "Le demandeur a retenu votre proposition.", link: "/dashboard/opportunites" }),
    n("opportunity_closed", "Clôture", "Le demandeur clôture la consultation", { title: "Consultation clôturée", body: "La consultation à laquelle vous avez répondu est clôturée.", link: "/dashboard/opportunites" }),
    n("alert_match", "Nouvelle opportunité (alerte immédiate)", "Publication ou collecte d'une opportunité correspondant à une alerte", { title: "Nouvelle opportunité pour votre alerte « Maintenance Finistère »", body: "Nettoyage des locaux du SDIS 22", link: "/opportunites/exemple" }),
    n("alert_digest", "Résumé d'alerte", "Quotidien ou hebdomadaire", { title: "Votre alerte « Maintenance Finistère »", body: "3 opportunités correspondent à vos critères depuis le dernier envoi.", items: [{ label: "Exemple d'opportunité", url: "/opportunites/exemple" }], unsubscribe: "/alertes/desabonnement?jeton=exemple" }),
    n("invitation", "Invitation d'un collaborateur", "Un administrateur d'entreprise invite une adresse", { title: "Vous êtes invité(e) à rejoindre Entreprise exemple", body: "Créez votre compte avec cette adresse e-mail pour rejoindre l'entreprise automatiquement.", link: "/inscription" }),
  ];
}
