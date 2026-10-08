import { afterEach, describe, expect, it } from "vitest";
import { decideRamp, type RampInput } from "@/lib/outreach/ramp";
import { env } from "@/lib/env";

const NOW = Date.parse("2026-10-08T05:00:00Z");
const DAY = 86_400_000;
const base: RampInput = { enabled: true, cap: 75, hourlyCap: 40, target: 200, lastAt: new Date(NOW - 8 * DAY).toISOString(), now: NOW, sent: 300, bounces: 3, unsubscribes: 2 };

describe("montée en charge des envois", () => {
  it("monte d'un palier par semaine saine, jusqu'à l'objectif", () => {
    expect(decideRamp(base)).toMatchObject({ action: "up", cap: 100, hourlyCap: 40 });
    expect(decideRamp({ ...base, cap: 100 })).toMatchObject({ action: "up", cap: 150, hourlyCap: 40 });
    expect(decideRamp({ ...base, cap: 150 })).toMatchObject({ action: "up", cap: 200, hourlyCap: 50 });
    expect(decideRamp({ ...base, cap: 200 })).toMatchObject({ action: "hold", cap: 200 });
    // Jamais au-delà de l'objectif
    expect(decideRamp({ ...base, cap: 150, target: 170 })).toMatchObject({ action: "up", cap: 170 });
  });

  it("attend une semaine entre deux paliers et assez d'envois pour juger", () => {
    expect(decideRamp({ ...base, lastAt: new Date(NOW - 3 * DAY).toISOString() }).action).toBe("hold");
    expect(decideRamp({ ...base, sent: 10, bounces: 0, unsubscribes: 0 }).action).toBe("hold");
    expect(decideRamp({ ...base, lastAt: null }).action).toBe("up");
  });

  it("garde le palier si rebonds ou désinscriptions sont élevés, redescend si les rebonds explosent", () => {
    expect(decideRamp({ ...base, bounces: 12 })).toMatchObject({ action: "hold", cap: 75 }); // 4 %
    expect(decideRamp({ ...base, unsubscribes: 9 })).toMatchObject({ action: "hold", cap: 75 }); // 3 %
    expect(decideRamp({ ...base, cap: 150, bounces: 20 })).toMatchObject({ action: "down", cap: 100 }); // 6,7 %
    expect(decideRamp({ ...base, cap: 50, bounces: 20 })).toMatchObject({ action: "hold", cap: 50 });
  });

  it("désactivée : rien ne change", () => {
    expect(decideRamp({ ...base, enabled: false })).toMatchObject({ action: "hold", cap: 75, hourlyCap: 40 });
  });
});

describe("expéditeur par défaut", () => {
  const saved = { ...process.env };
  afterEach(() => {
    for (const k of ["EMAIL_FROM", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"]) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("sans EMAIL_FROM, la boîte SMTP connectée (Gmail…) est l'expéditeur", () => {
    delete process.env.EMAIL_FROM;
    Object.assign(process.env, { SMTP_HOST: "smtp.gmail.com", SMTP_USER: "linkprob2b.test@gmail.com", SMTP_PASSWORD: "x" });
    expect(env.emailFrom).toBe("LinkProB2B <linkprob2b.test@gmail.com>");
    process.env.EMAIL_FROM = "LinkProB2B <contact@linkprob2b.com>";
    expect(env.emailFrom).toBe("LinkProB2B <contact@linkprob2b.com>");
  });

  it("sans SMTP, adresse du domaine", () => {
    for (const k of ["EMAIL_FROM", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"]) delete process.env[k];
    expect(env.emailFrom).toMatch(/^LinkProB2B <notifications@/);
  });
});
