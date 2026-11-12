import { Mail, PenLine, Send } from "lucide-react";
import { visitorRpc } from "@/lib/queries/public-cache";

const nf = (n: number) => n.toLocaleString("fr-FR");

/**
 * « Ce qui se passe quand vous publiez » : les trois étapes, et la preuve réelle (besoins déjà
 * publiés par des entreprises inscrites, entreprises du métier prévenues). Chiffres agrégés,
 * affichés seulement quand ils sont parlants.
 */
export async function NeedProof() {
  const { data } = await visitorRpc("public_need_proof", undefined as never, { always: true });
  const proof = (data ?? null) as { needs?: number; contacted?: number } | null;
  const needs = Number(proof?.needs ?? 0);
  const contacted = Number(proof?.contacted ?? 0);
  const show = needs >= 2 && contacted >= needs * 5;
  const steps = [
    { icon: PenLine, t: "Vous décrivez votre besoin", d: "Deux minutes, gratuitement, sans carte bancaire." },
    { icon: Send, t: "Nous le diffusons aux entreprises du métier", d: "Aux entreprises inscrites concernées et aux spécialistes de votre secteur et de votre zone." },
    { icon: Mail, t: "Elles vous répondent directement", d: "Par message ou par e-mail, même sans créer de compte. Sous 48 h, vous recevez le point sur la diffusion." },
  ];
  return (
    <section aria-labelledby="apres-publication" className="mb-6 rounded-2xl bg-gradient-to-br from-teal-50 to-sky p-5 ring-1 ring-teal/25">
      <h2 id="apres-publication" className="font-bold text-navy">
        Ce qui se passe quand vous publiez
      </h2>
      <ol className="mt-3 space-y-3">
        {steps.map((s, i) => (
          <li key={s.t} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-teal-700 ring-1 ring-teal/30">{i + 1}</span>
            <span className="text-sm">
              <span className="font-semibold text-navy">{s.t}</span>
              <span className="block text-slate-600">{s.d}</span>
            </span>
          </li>
        ))}
      </ol>
      {show && (
        <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200">
          Jusqu&apos;ici, les <strong className="text-navy">{nf(needs)} besoins</strong> publiés par des entreprises ont été envoyés à{" "}
          <strong className="text-navy">{nf(contacted)} entreprises du métier</strong>, soit environ {nf(Math.round(contacted / needs))} par besoin.
        </p>
      )}
    </section>
  );
}
