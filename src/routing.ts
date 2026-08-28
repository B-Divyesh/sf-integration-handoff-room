export type AppPage = "/" | "/demo" | "/privacy" | "/terms" | "/404";

export interface RouteMetadata {
  title: string;
  description: string;
  canonicalPath: string;
}

const routeMetadata: Record<AppPage, RouteMetadata> = {
  "/": {
    title: "Integration Handoff Room — client API handoffs",
    description: "Review a safe API example, decisions, owners, and a handover acknowledgement in one client-ready room.",
    canonicalPath: "/"
  },
  "/demo": {
    title: "Demo — Integration Handoff Room",
    description: "Try a safe sample API handoff room with a fixture, checklist, acknowledgement, and export.",
    canonicalPath: "/demo"
  },
  "/privacy": {
    title: "Privacy — Integration Handoff Room",
    description: "Learn how the sample room keeps demo data separate and what the product will store when real rooms launch.",
    canonicalPath: "/privacy"
  },
  "/terms": {
    title: "Terms — Integration Handoff Room",
    description: "Read the plain-language terms for the Integration Handoff Room sample and planned Studio service.",
    canonicalPath: "/terms"
  },
  "/404": {
    title: "Page not found — Integration Handoff Room",
    description: "The requested Integration Handoff Room coordinate could not be found.",
    canonicalPath: "/404"
  }
};

export function pageForPath(pathname: string): AppPage {
  if (pathname === "/" || pathname === "/demo" || pathname === "/privacy" || pathname === "/terms") {
    return pathname;
  }

  return "/404";
}

export function pageForLocation(pathname: string, search: string): AppPage {
  if (pathname === "/" && new URLSearchParams(search).get("demo") === "1") {
    return "/demo";
  }

  return pageForPath(pathname);
}

export function metadataFor(page: AppPage): RouteMetadata {
  return routeMetadata[page];
}

export function pageTitle(page: AppPage): string {
  return metadataFor(page).title;
}
