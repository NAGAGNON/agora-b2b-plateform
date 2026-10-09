import { Mail, MessageCircle, Share2 } from "lucide-react";

/**
 * Partage d'une page (LinkedIn, WhatsApp, e-mail) par simples liens : aucun script ni traceur tiers
 * chargé sur le site, rien n'est envoyé avant le clic du visiteur.
 */
export function ShareLinks({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url);
  const text = encodeURIComponent(`${title} — ${url}`);
  const item = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-navy hover:border-teal hover:bg-sky";
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-600">Partager cette opportunité</p>
      <div className="flex flex-wrap gap-2">
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`} target="_blank" rel="noopener noreferrer nofollow" className={item}>
          <Share2 className="size-4" aria-hidden /> LinkedIn
        </a>
        <a href={`https://wa.me/?text=${text}`} target="_blank" rel="noopener noreferrer nofollow" className={item}>
          <MessageCircle className="size-4" aria-hidden /> WhatsApp
        </a>
        <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${text}`} className={item}>
          <Mail className="size-4" aria-hidden /> E-mail
        </a>
      </div>
    </div>
  );
}
