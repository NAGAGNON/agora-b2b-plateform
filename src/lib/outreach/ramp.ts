/**
 * Montée en charge des envois (réputation de l'adresse d'envoi) : une fois par semaine au plus,
 * la limite quotidienne monte d'un palier si la semaine écoulée s'est bien passée, et redescend
 * d'un palier si les rebonds deviennent trop nombreux. Jamais au-delà de l'objectif fixé.
 */
export const RAMP_STEPS = [50, 75, 100, 150, 200] as const;
export const RAMP_INTERVAL_DAYS = 7;
const MIN_SENT_TO_JUDGE = 20;
const MAX_BOUNCE_UP = 0.03; // < 3 % de rebonds pour monter
const MAX_UNSUB_UP = 0.02; // < 2 % de désinscriptions / plaintes pour monter
const BOUNCE_DOWN = 0.05; // ≥ 5 % de rebonds : on redescend

export type RampInput = {
  enabled: boolean;
  cap: number;
  hourlyCap: number;
  target: number;
  lastAt: string | null;
  now: number;
  /** Semaine écoulée */
  sent: number;
  bounces: number;
  unsubscribes: number;
};

export type RampDecision = { action: "up" | "down" | "hold"; cap: number; hourlyCap: number; reason: string };

const nextUp = (cap: number) => RAMP_STEPS.find((s) => s > cap) ?? cap + 50;
const nextDown = (cap: number) => [...RAMP_STEPS].reverse().find((s) => s < cap) ?? RAMP_STEPS[0];
const pct = (x: number) => `${Math.round(x * 1000) / 10} %`;

export function decideRamp(i: RampInput): RampDecision {
  const hold = (reason: string): RampDecision => ({ action: "hold", cap: i.cap, hourlyCap: i.hourlyCap, reason });
  if (!i.enabled) return hold("Montée en charge automatique désactivée");
  if (i.lastAt && i.now - new Date(i.lastAt).getTime() < RAMP_INTERVAL_DAYS * 86_400_000) return hold("Palier actuel en observation (une semaine)");
  if (i.sent < MIN_SENT_TO_JUDGE) return hold(`Pas assez d'envois sur la semaine pour juger (${i.sent})`);
  const bounceRate = i.bounces / i.sent;
  const unsubRate = i.unsubscribes / i.sent;
  if (bounceRate >= BOUNCE_DOWN && i.cap > RAMP_STEPS[0]) {
    return { action: "down", cap: nextDown(i.cap), hourlyCap: i.hourlyCap, reason: `Trop de rebonds sur la semaine (${pct(bounceRate)}) : limite abaissée` };
  }
  if (i.cap >= i.target) return hold("Objectif atteint");
  if (bounceRate >= MAX_BOUNCE_UP || unsubRate >= MAX_UNSUB_UP) return hold(`Palier maintenu : rebonds ${pct(bounceRate)}, désinscriptions ${pct(unsubRate)}`);
  const cap = Math.min(i.target, nextUp(i.cap));
  // Les envois se font sur quelques passages par jour : la limite horaire suit (≈ un quart du jour)
  return { action: "up", cap, hourlyCap: Math.max(i.hourlyCap, Math.ceil(cap / 4)), reason: `Semaine saine (rebonds ${pct(bounceRate)}, désinscriptions ${pct(unsubRate)}) : limite relevée` };
}
