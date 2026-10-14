import "server-only";
import { promises as dns } from "node:dns";

export type DnsCheck = { label: string; ok: boolean | null; detail: string };

const txt = async (name: string) => {
  try {
    return (await dns.resolveTxt(name)).map((r) => r.join(""));
  } catch {
    return [];
  }
};

/** Sélecteurs DKIM courants (Google, Microsoft, hébergeurs) : le vrai sélecteur dépend du fournisseur. */
const DKIM_SELECTORS = ["default", "google", "selector1", "selector2", "mail", "dkim", "k1", "s1", "s2", "hostingermail1", "titan1", "mx", "smtp", "ovh", "ovhmo"];

/** Vérifie en direct (DNS public) SPF, DKIM et DMARC du domaine d'expédition. Lecture seule. */
export async function checkDeliverability(domain: string): Promise<DnsCheck[]> {
  const [root, dmarc, mx, ...dkim] = await Promise.all([
    txt(domain),
    txt(`_dmarc.${domain}`),
    dns.resolveMx(domain).catch(() => []),
    ...DKIM_SELECTORS.map((s) => txt(`${s}._domainkey.${domain}`).then((r) => ({ s, r }))),
  ]);
  const spf = root.find((r) => r.toLowerCase().startsWith("v=spf1"));
  const dm = dmarc.find((r) => r.toLowerCase().startsWith("v=dmarc1"));
  const found = dkim.filter((d) => d.r.some((r) => /v=dkim1|k=rsa|p=/i.test(r))).map((d) => d.s);
  const policy = dm?.match(/p=(\w+)/i)?.[1]?.toLowerCase();
  return [
    { label: "Serveurs de réception (MX)", ok: mx.length > 0, detail: mx.length ? mx.map((m) => m.exchange).join(", ") : "Aucun enregistrement MX" },
    { label: "SPF", ok: Boolean(spf), detail: spf ?? "Aucun enregistrement SPF : les messageries ne peuvent pas vérifier que ce serveur a le droit d'envoyer pour le domaine." },
    {
      label: "DKIM",
      ok: found.length ? true : null,
      detail: found.length ? `Signature trouvée (sélecteur : ${found.join(", ")})` : "Aucun sélecteur courant trouvé. Vérifiez dans l'interface de votre hébergeur e-mail que la signature DKIM est activée (le sélecteur peut avoir un autre nom).",
    },
    {
      label: "DMARC",
      ok: dm ? true : false,
      detail: dm ? `${dm}${policy === "none" ? " — politique « none » : suffisante pour démarrer, à renforcer (quarantine) une fois les envois stables." : ""}` : "Aucun enregistrement DMARC : ajoutez au minimum « v=DMARC1; p=none; » sur _dmarc du domaine.",
    },
  ];
}
