import type { TenderBrief } from "@/lib/tender-brief";

export type DraftCompany = {
  name: string;
  city: string | null;
  description: string | null;
  references: string | null;
  certifications: string[];
  employees: string | null;
  founded: number | null;
};

const TODO = (s: string) => `[À compléter : ${s}]`;

/** Mots qui relient un conseil de l'avis à un critère (ex. « délais » → critère « Délais d'intervention »). */
const words = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 4);

/**
 * Trame du mémoire technique, organisée selon les critères de notation de l'avis et pré-remplie avec
 * la fiche de l'entreprise. Ce qui n'est pas connu est laissé entre crochets « [À compléter : …] » :
 * rien n'est inventé.
 */
export function buildMemoirDraft(o: { title: string; buyer: string | null }, brief: TenderBrief | null, c: DraftCompany): string {
  const lines: string[] = [];
  lines.push("MÉMOIRE TECHNIQUE", "", `Objet : ${o.title}`);
  if (o.buyer) lines.push(`Acheteur : ${o.buyer}`);
  lines.push(`Candidat : ${c.name}${c.city ? ` (${c.city})` : ""}`, "");

  lines.push("1. Présentation de l'entreprise", "");
  lines.push(c.description?.trim() || TODO("activité, savoir-faire, implantation"));
  const facts = [c.founded ? `Création : ${c.founded}` : null, c.employees ? `Effectif : ${c.employees}` : null].filter(Boolean);
  if (facts.length) lines.push(facts.join(" · "));
  lines.push(`Certifications et qualifications : ${c.certifications.length ? c.certifications.join(", ") : TODO("vos certifications, qualifications et habilitations")}`);
  if (brief?.certifications?.length) lines.push(`Exigées par l'acheteur : ${brief.certifications.join(", ")}`);
  lines.push("");

  lines.push("2. Compréhension du besoin", "");
  if (brief?.summary) lines.push(`Selon l'avis : ${brief.summary}`);
  lines.push(TODO("reformulez avec vos mots les attentes de l'acheteur, les contraintes du site et les points sensibles"));
  if (brief?.lots?.length) lines.push(`Lots concernés : ${brief.lots.join(" ; ")} ${TODO("précisez le ou les lots auxquels vous répondez")}`);
  lines.push("");

  // Une partie par critère technique (le prix se traite dans les documents de prix)
  const criteria = (brief?.criteria ?? []).filter((x) => !/^prix|co[uû]t|montant/i.test(x.label.trim()));
  const tips = brief?.tips ?? [];
  let n = 3;
  if (criteria.length) {
    for (const cr of criteria) {
      lines.push(`${n}. ${cr.label}${cr.weight ? ` (${cr.weight} % de la note)` : ""}`, "");
      const w = new Set(words(cr.label));
      const related = tips.filter((t) => words(t).some((x) => w.has(x)));
      for (const t of related) lines.push(`Conseil : ${t}`);
      lines.push(TODO(`votre réponse détaillée sur « ${cr.label} » : méthode, moyens, exemples concrets`), "");
      n++;
    }
  } else {
    for (const s of ["Méthodologie et organisation du chantier ou de la prestation", "Moyens humains et matériels", "Planning et délais", "Qualité, sécurité et environnement"]) {
      lines.push(`${n}. ${s}`, "", TODO(s.toLowerCase()), "");
      n++;
    }
  }

  lines.push(`${n}. Références similaires`, "");
  lines.push(c.references?.trim() || TODO("2 ou 3 chantiers ou prestations comparables : client, année, montant, ce que vous avez réalisé"));
  lines.push("");
  n++;

  if (brief?.documents?.length) {
    lines.push(`${n}. Pièces jointes`, "");
    for (const d of brief.documents) lines.push(`- ${d}`);
    lines.push("");
  }
  return lines.join("\n");
}
