const eurFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const numFmt = new Intl.NumberFormat("fr-FR");
export const eur = (n: number | string | null | undefined) => (n === null || n === undefined || n === "" ? "—" : eurFmt.format(Number(n)));
export const num = (n: number | null | undefined) => (n === null || n === undefined ? "—" : numFmt.format(n));
export const pct = (n: number | string | null | undefined) => (n === null || n === undefined || n === "" ? "—" : `${Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);
export const dateFr = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
export const dateTimeFr = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
export const monthShort = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
};
export const monthLong = (y: number, m: number) => new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
export function ago(d: string): string {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}
