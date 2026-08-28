export type AppPage = "/" | "/demo" | "/privacy" | "/terms" | "/rooms" | "/rooms/new" | "/room" | "/review" | "/settings/billing" | "/auth/callback" | "/404";

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
  "/rooms": {
    title: "Rooms — Integration Handoff Room",
    description: "Create and manage private client API handoff rooms.",
    canonicalPath: "/rooms"
  },
  "/rooms/new": {
    title: "Create a room — Integration Handoff Room",
    description: "Import and sanitize a GitHub fixture for a new client handoff room.",
    canonicalPath: "/rooms/new"
  },
  "/room": {
    title: "Agency room — Integration Handoff Room",
    description: "Manage a private API handoff room, client questions, and acknowledgement.",
    canonicalPath: "/rooms"
  },
  "/review": {
    title: "Client review — Integration Handoff Room",
    description: "Review one private API release fixture, ask questions, and acknowledge the revision.",
    canonicalPath: "/review"
  },
  "/settings/billing": {
    title: "Billing — Integration Handoff Room",
    description: "Start or restore the Studio subscription through Sociobot hosted checkout.",
    canonicalPath: "/settings/billing"
  },
  "/auth/callback": {
    title: "Signing in — Integration Handoff Room",
    description: "Complete Sociobot account sign-in for Integration Handoff Room.",
    canonicalPath: "/auth/callback"
  },
  "/404": {
    title: "Page not found — Integration Handoff Room",
    description: "The requested Integration Handoff Room coordinate could not be found.",
    canonicalPath: "/404"
  }
};

export function pageForPath(pathname: string): AppPage {
  if (pathname === "/" || pathname === "/demo" || pathname === "/privacy" || pathname === "/terms" || pathname === "/rooms" || pathname === "/rooms/new" || pathname === "/settings/billing" || pathname === "/auth/callback") {
    return pathname;
  }

  if (/^\/rooms\/[^/]+$/.test(pathname)) return "/room";
  if (/^\/review\/[^/]+$/.test(pathname)) return "/review";

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
