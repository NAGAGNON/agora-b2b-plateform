"use client";

import { useState } from "react";
import { Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { trackNeedShare } from "@/app/actions/opportunities";

/**
 * Partage d'une page (LinkedIn, WhatsApp, e-mail, lien copié) par simples liens : aucun script ni
 * traceur tiers chargé sur le site, rien n'est envoyé avant le clic du visiteur. Pour un besoin
 * d'entreprise (`needId`), chaque partage est compté dans son suivi.
 */
export function ShareLinks({ url, title, needId, label = "Partager cette opportunité" }: { url: string; title: string; needId?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const text = encodeURIComponent(`${title} — ${url}`);
  const count = (channel: string) => needId && void trackNeedShare(needId, channel);
  const item = "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-navy hover:border-teal hover:bg-sky";
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-600">{label}</p>
      <div className="flex flex-wrap gap-2">
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`} target="_blank" rel="noopener noreferrer nofollow" className={item} onClick={() => count("linkedin")}>
          <Share2 className="size-4" aria-hidden /> LinkedIn
        </a>
        <a href={`https://wa.me/?text=${text}`} target="_blank" rel="noopener noreferrer nofollow" className={item} onClick={() => count("whatsapp")}>
          <MessageCircle className="size-4" aria-hidden /> WhatsApp
        </a>
        <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${text}`} className={item} onClick={() => count("email")}>
          <Mail className="size-4" aria-hidden /> E-mail
        </a>
        <button
          type="button"
          className={item}
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false));
            count("lien");
          }}
        >
          <Copy className="size-4" aria-hidden /> {copied ? "Lien copié" : "Copier le lien"}
        </button>
      </div>
    </div>
  );
}
