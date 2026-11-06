import { escapeHtml } from "@/lib/email/escape";
import type { TenderBrief } from "@/lib/tender-brief";

/**
 * Fiche synthèse en document autonome (impression / PDF, ou Word) : mêmes informations que la page,
 * étapes cochées par l'entreprise comprises. Aucun ajout : uniquement le contenu de la fiche.
 */
export function briefDocument(b: TenderBrief, o: { title: string; buyer: string | null; url: string; source: string | null; done: number[]; print: boolean }): string {
  const e = escapeHtml;
  const key = [
    ["Remise des offres", b.deadline],
    ["Visite", b.site_visit],
    ["Durée", b.duration],
    ["Prix", b.pricing],
  ].filter(([, v]) => v) as [string, string][];
  const list = (items: string[]) => `<ul>${items.map((t) => `<li>${e(t)}</li>`).join("")}</ul>`;
  const done = new Set(o.done);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fiche synthèse — ${e(o.title)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#0A1A33;max-width:760px;margin:24px auto;padding:0 16px;line-height:1.45;font-size:14px}
h1{font-size:22px;margin:4px 0 6px}h2{font-size:15px;margin:22px 0 8px;color:#0B7A6E;text-transform:uppercase;letter-spacing:.4px}
.kicker{font-size:12px;font-weight:bold;color:#0B7A6E;text-transform:uppercase;letter-spacing:.6px}
.muted{color:#4A5568}.keys{display:flex;flex-wrap:wrap;gap:8px}.key{border:1px solid #cfe9e4;background:#f0faf8;border-radius:8px;padding:6px 10px}
.key b{display:block;font-size:11px;color:#4A5568;text-transform:uppercase}ul{padding-left:18px;margin:6px 0}li{margin:3px 0}
.todo{list-style:none;padding-left:0}.todo li{margin:5px 0}.warn{border:1px solid #f3c1c9;background:#fff5f6;border-radius:8px;padding:8px 12px}
.foot{margin-top:24px;font-size:11px;color:#6A7686;border-top:1px solid #e2e8f0;padding-top:8px}
@media print{body{margin:0}a{color:inherit;text-decoration:none}}
</style></head><body>
<p class="kicker">LinkProB2B · Fiche synthèse</p>
<h1>${e(o.title)}</h1>
${o.buyer ? `<p class="muted">${e(o.buyer)}</p>` : ""}
<p>${e(b.summary)}</p>
${key.length ? `<div class="keys">${key.map(([k, v]) => `<div class="key"><b>${e(k)}</b>${e(v)}</div>`).join("")}</div>` : ""}
${b.lots.length ? `<h2>Lots</h2>${list(b.lots)}` : ""}
${b.documents.length ? `<h2>Pièces à fournir</h2>${list(b.documents)}` : ""}
<h2>Comment l'offre sera jugée</h2><p>${e(b.judging)}</p>
${b.todo.length ? `<h2>À faire</h2><ul class="todo">${b.todo.map((t, i) => `<li>${done.has(i) ? "☑" : "☐"} ${e(t)}</li>`).join("")}</ul>` : ""}
${b.warnings.length ? `<h2>Points d'attention</h2><div class="warn">${list(b.warnings)}</div>` : ""}
<p class="foot">D'après l'avis officiel${o.source ? ` (${e(o.source)})` : ""}. En cas de doute, le dossier de consultation fait foi. Fiche en ligne : ${e(o.url)}</p>
${o.print ? "<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script>" : ""}
</body></html>`;
}

/** Nom de fichier lisible et sûr. */
export function briefFileName(title: string, ext: string) {
  const base = title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "fiche";
  return `fiche-synthese-${base.toLowerCase()}.${ext}`;
}
