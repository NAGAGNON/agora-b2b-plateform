/**
 * Score commercial d'un membre (probabilité de payer), tiré de son comportement réel sur le site.
 * Barème simple et lisible (un critère rempli = ses points) :
 *  revenu plusieurs jours +20 · marchés consultés +10 · liens officiels ouverts +15 · alerte +15 ·
 *  favoris +10 · entreprise créée +10. Total sur 80, puis un léger bonus d'intensité (jusqu'à +20)
 *  pour départager les membres très actifs.
 */
export type BuyerSignals = {
  days: number;
  views: number;
  searches: number;
  sources: number;
  alerts: number;
  favorites: number;
  hasCompany: boolean;
};

export const CRITERIA = [
  { key: "days", label: "Revenu plusieurs jours", points: 20, met: (s: BuyerSignals) => s.days >= 2 },
  { key: "views", label: "Marchés consultés", points: 10, met: (s: BuyerSignals) => s.views > 0 },
  { key: "sources", label: "Liens officiels ouverts", points: 15, met: (s: BuyerSignals) => s.sources > 0 },
  { key: "alerts", label: "Alerte créée", points: 15, met: (s: BuyerSignals) => s.alerts > 0 },
  { key: "favorites", label: "Favoris ajoutés", points: 10, met: (s: BuyerSignals) => s.favorites > 0 },
  { key: "company", label: "Entreprise créée", points: 10, met: (s: BuyerSignals) => s.hasCompany },
] as const;

export type Level = "CHAUD" | "TIEDE" | "FROID";

export function buyingScore(s: BuyerSignals) {
  const base = CRITERIA.reduce((n, c) => n + (c.met(s) ? c.points : 0), 0);
  // Intensité : jours de visite, liens officiels et marchés consultés (plafonnée à +20)
  const bonus = Math.min(20, Math.max(0, s.days - 2) * 3 + Math.min(s.sources, 10) + Math.floor(Math.min(s.views, 100) / 20));
  const score = base + bonus;
  const level: Level = score >= 60 ? "CHAUD" : score >= 35 ? "TIEDE" : "FROID";
  return { score, base, bonus, level, met: CRITERIA.filter((c) => c.met(s)).map((c) => c.key) };
}
