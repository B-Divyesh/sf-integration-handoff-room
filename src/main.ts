import "./styles/app.css";
import { pageForPath, pageTitle } from "./routing";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("The application root is missing.");
}

const appRoot = app;

function render(): void {
  const page = pageForPath(window.location.pathname);
  document.title = pageTitle(page);
  appRoot.innerHTML = `
    <a class="skip-link" href="#main">Skip to main content</a>
    <header class="site-header">
      <a class="wordmark" href="/" aria-label="Integration Handoff Room home">
        <span class="wordmark-mark" aria-hidden="true"></span>
        <span>Integration Handoff Room</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="/demo">Demo</a>
        <a href="/privacy">Privacy</a>
      </nav>
    </header>
    <main id="main" tabindex="-1">
      <section class="scaffold" aria-labelledby="scaffold-heading">
        <p class="eyebrow">Builder scaffold</p>
        <h1 id="scaffold-heading">The handoff room is being prepared.</h1>
        <p>
          This working shell gives M1 a typed frontend, route-aware document titles,
          accessible landmarks, and the orbital protocol atlas token system.
        </p>
        <p class="scaffold-note">Planned route: <code>${page}</code></p>
      </section>
    </main>
    <footer class="site-footer">
      <p>A client-ready room for API integration handoffs.</p>
      <nav aria-label="Footer navigation">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
      <p>Built by Param Factory · build dev</p>
    </footer>
  `;
}

function navigate(event: MouseEvent): void {
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!link || link.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  const next = new URL(link.href);
  if (next.origin !== window.location.origin) {
    return;
  }

  event.preventDefault();
  window.history.pushState({}, "", `${next.pathname}${next.search}${next.hash}`);
  render();
  document.querySelector<HTMLElement>("h1")?.focus();
}

document.addEventListener("click", navigate);
window.addEventListener("popstate", render);
render();
