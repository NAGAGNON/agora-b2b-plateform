import { describe, expect, it } from "vitest";
import { safeInternalPath } from "@/lib/safe-path";

describe("redirections internes uniquement", () => {
  it("garde les chemins du site", () => {
    expect(safeInternalPath("/opportunites/abc?x=1#y")).toBe("/opportunites/abc?x=1#y");
    expect(safeInternalPath("/dashboard")).toBe("/dashboard");
  });

  it("refuse les adresses externes et leurs variantes", () => {
    for (const v of ["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/%0d/x\r\n", "evil.com", "", null, 42]) {
      expect(safeInternalPath(v, "/repli")).toBe("/repli");
    }
  });
});
