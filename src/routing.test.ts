import { describe, expect, it } from "vitest";
import { pageForPath, pageTitle } from "./routing";

describe("route metadata", () => {
  it("uses a product-specific title for the demo route", () => {
    expect(pageTitle(pageForPath("/demo"))).toBe("Demo — Integration Handoff Room");
  });

  it("sends unknown routes to the designed not-found state", () => {
    expect(pageForPath("/unknown-coordinate")).toBe("/404");
  });
});
