export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type Layout = { title: string; paragraphs: string[]; cta?: { label: string; url: string }; footer?: string; list?: { label: string; url: string }[] };

/** Gabarit HTML sobre, compatible clients e-mail, aux couleurs LinkProB2B. */
export function renderEmail({ title, paragraphs, cta, footer, list }: Layout): { html: string; text: string } {
  const p = paragraphs.map((t) => `<p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:22px">${escapeHtml(t)}</p>`).join("");
  const items = list?.length
    ? `<ul style="padding-left:18px;margin:0 0 16px">${list
        .map((i) => `<li style="margin:0 0 8px"><a href="${escapeHtml(i.url)}" style="color:#0F2D4A">${escapeHtml(i.label)}</a></li>`)
        .join("")}</ul>`
    : "";
  const button = cta
    ? `<p style="margin:20px 0"><a href="${escapeHtml(cta.url)}" style="background:#14B8A6;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>`
    : "";
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#E8F4FD;font-family:Inter,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px">
<tr><td style="background:#0F2D4A;border-radius:12px 12px 0 0;padding:18px 24px;color:#ffffff;font-weight:700;font-size:18px">LinkPro<span style="color:#14B8A6">B2B</span></td></tr>
<tr><td style="padding:24px"><h1 style="margin:0 0 16px;font-size:20px;color:#0F2D4A">${escapeHtml(title)}</h1>${p}${items}${button}
<p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:18px">${escapeHtml(footer ?? "Vous recevez cet e-mail car vous avez un compte LinkProB2B. Gérez vos préférences dans votre espace, rubrique Paramètres.")}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [title, "", ...paragraphs, ...(list?.map((i) => `- ${i.label} : ${i.url}`) ?? []), cta ? `${cta.label} : ${cta.url}` : "", "", footer ?? ""].join("\n");
  return { html, text };
}
