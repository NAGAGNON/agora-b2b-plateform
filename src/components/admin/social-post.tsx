"use client";

import { Copy } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Message du jour prêt à publier (LinkedIn, Google Business), construit avec les chiffres réels. */
export function SocialPostCard({ text }: { text: string | null }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text ?? "");
      toast("Message copié : collez-le dans LinkedIn.");
    } catch {
      toast("Copie impossible : sélectionnez le texte et copiez-le.", "error");
    }
  };
  return (
    <Card>
      <CardHeader
        title="Message prêt à publier sur LinkedIn"
        description="Chiffres réels des offres publiées. Publiez-le sur votre page LinkedIn ou Google Business pour faire venir des visiteurs."
        action={
          text ? (
            <Button variant="outline" size="sm" onClick={copy}>
              <Copy className="size-4" aria-hidden /> Copier le message
            </Button>
          ) : undefined
        }
      />
      <div className="p-5">
        {text ? (
          <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700" data-testid="social-post">
            {text}
          </p>
        ) : (
          <p className="text-sm text-slate-600">Aucune nouvelle offre publiée ces 7 derniers jours : pas de message à publier pour l&apos;instant.</p>
        )}
      </div>
    </Card>
  );
}
