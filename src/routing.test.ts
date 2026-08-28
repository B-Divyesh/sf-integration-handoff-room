import { describe, expect, it } from "vitest";
import { metadataFor, pageForLocation, pageForPath, pageTitle } from "./routing";

describe("route metadata", () => {
  it("uses a product-specific title for the demo route", () => {
    expect(pageTitle(pageForPath("/demo"))).toBe("Demo — Integration Handoff Room");
  });

  it("sends unknown routes to the designed not-found state", () => {
    expect(pageForPath("/unknown-coordinate")).toBe("/404");
  });

  it("opens the demo directly from the documented query entry point", () => {
    expect(pageForLocation("/", "?demo=1")).toBe("/demo");
  });

  it("gives every route a canonical plain-language description", () => {
    expect(metadataFor("/privacy").description).toContain("sample room");
  });
});
