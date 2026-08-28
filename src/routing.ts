export type AppPage = "/" | "/demo" | "/privacy" | "/terms" | "/404";

const routeTitles: Record<AppPage, string> = {
  "/": "Integration Handoff Room — client API handoffs",
  "/demo": "Demo — Integration Handoff Room",
  "/privacy": "Privacy — Integration Handoff Room",
  "/terms": "Terms — Integration Handoff Room",
  "/404": "Page not found — Integration Handoff Room"
};

export function pageForPath(pathname: string): AppPage {
  if (pathname === "/" || pathname === "/demo" || pathname === "/privacy" || pathname === "/terms") {
    return pathname;
  }

  return "/404";
}

export function pageTitle(page: AppPage): string {
  return routeTitles[page];
}
