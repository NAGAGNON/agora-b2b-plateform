import { describe, expect, it } from "vitest";
import { humanVisitors } from "@/lib/outreach/human-visits";

describe("visites réelles depuis la prospection", () => {
  it("un clic seul ou une seule page ne compte pas ; 2 pages ou une action comptent", () => {
    const v = humanVisitors([
      { recipient_id: "robot", type: "CLICK" },
      { recipient_id: "robot", type: "LANDING_VIEW" },
      { recipient_id: "lecteur", type: "LANDING_VIEW" },
      { recipient_id: "lecteur", type: "OPPORTUNITY_VIEW" },
      { recipient_id: "inscrit", type: "GATE_SIGNUP_CLICK" },
      { recipient_id: "ouvert", type: "OPEN" },
    ]);
    expect([...v].sort()).toEqual(["inscrit", "lecteur"]);
  });
});
