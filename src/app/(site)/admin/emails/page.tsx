import { PREVIEW_SANDBOX, previewHtml } from "@/lib/email-preview";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { emailCatalog } from "@/lib/email/catalog";
import { renderEmail } from "@/lib/email/templates";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { EmailCheck } from "@/components/admin/email-check";

export const metadata = { title: "E-mails" };

export default async function AdminEmailsPage() {
  await requireAdmin();
  const transport = env.emailTransport;
  const items = emailCatalog();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">E-mails envoyés par la plateforme</h1>
        <p className="mt-1 text-slate-600">{items.length} modèles, en HTML et en texte, aux couleurs de LinkProB2B. Contenus d&apos;exemple ci-dessous.</p>
      </div>
      <Notice tone={transport === "smtp" || transport === "resend" ? "success" : "info"}>
        Transport actuel :{" "}
        {transport === "smtp"
          ? `SMTP du domaine (${process.env.SMTP_HOST}) — aucun coût par e-mail`
          : transport === "resend"
            ? "Resend (API) — renseignez SMTP_HOST, SMTP_USER et SMTP_PASSWORD pour passer au SMTP du domaine"
            : transport === "mailpit"
              ? "boîte de test (aucun e-mail ne sort)"
              : "aucun — renseignez le serveur SMTP du domaine (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)"}{" "}
        · expéditeur {env.emailFrom}
      </Notice>
      <EmailCheck enabled={Boolean(transport)} />
      <ul className="grid gap-6 lg:grid-cols-2">
        {items.map((e) => {
          const { html } = renderEmail(e.layout);
          return (
            <li key={e.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="space-y-1 border-b border-slate-100 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-navy">{e.label}</p>
                  <Badge tone="slate">{e.key}</Badge>
                </div>
                <p className="text-xs text-slate-500">Déclencheur : {e.trigger}</p>
                <p className="text-sm text-slate-700">Objet : {e.subject}</p>
              </div>
              <iframe title={`Aperçu : ${e.label}`} srcDoc={previewHtml(html)} sandbox={PREVIEW_SANDBOX} className="h-96 w-full border-0 bg-sky" />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
