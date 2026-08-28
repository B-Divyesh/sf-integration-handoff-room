import "./styles/app.css";
import {
  acknowledgeDemo,
  canAcknowledge,
  completedRequiredCount,
  createHandoverRecord,
  fixturePayload,
  loadDemoState,
  requiredCount,
  resetDemoState,
  saveDemoState,
  setChecklistItem,
  type DemoState
} from "./demo";
import { metadataFor, pageForLocation, type AppPage } from "./routing";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("The application root is missing.");
}

const appRoot = app;
const SITE_ORIGIN = "https://integration-handoff-room.sociobot.in";
let demoState: DemoState | undefined;
let statusMessage = "";
let shouldFocusHeading = false;

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    };
    return entities[character] ?? character;
  });
}

function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(new Date(isoDate));
}

function updateMetadata(page: AppPage): void {
  const metadata = metadataFor(page);
  document.title = metadata.title;
  const absoluteCanonical = `${SITE_ORIGIN}${metadata.canonicalPath}`;

  const update = (selector: string, value: string): void => {
    const element = document.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
    if (!element) return;
    if (element instanceof HTMLLinkElement) element.href = value;
    else element.content = value;
  };

  update('meta[name="description"]', metadata.description);
  update('link[rel="canonical"]', absoluteCanonical);
  update('meta[property="og:title"]', metadata.title);
  update('meta[property="og:description"]', metadata.description);
  update('meta[name="twitter:title"]', metadata.title);
  update('meta[name="twitter:description"]', metadata.description);
}

function header(page: AppPage): string {
  return `
    <a class="skip-link" href="#main">Skip to main content</a>
    <header class="site-header">
      <a class="wordmark" href="/" aria-label="Integration Handoff Room home">
        <span class="wordmark-mark" aria-hidden="true"></span>
        <span>Integration Handoff Room</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="/demo"${page === "/demo" ? ' aria-current="page"' : ""}>Demo</a>
        <a href="/#how-it-works">How it works</a>
        <a href="/#pricing">Pricing</a>
        <a href="/privacy"${page === "/privacy" ? ' aria-current="page"' : ""}>Privacy</a>
        <button class="theme-toggle" type="button" data-action="toggle-theme" aria-pressed="false">Day chart</button>
      </nav>
    </header>
  `;
}

function footer(): string {
  return `
    <footer class="site-footer">
      <p>A client-ready room for safe API handoffs.</p>
      <nav aria-label="Footer navigation">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
      <p>Built by Param Factory · build dev</p>
    </footer>
  `;
}

function orbitAtlas(label: string): string {
  return `
    <figure class="orbit-atlas" aria-labelledby="atlas-caption">
      <div class="orbit-atlas__grid" aria-hidden="true">
        <span class="orbit orbit--outer"></span><span class="orbit orbit--inner"></span>
        <span class="orbit-node orbit-node--fixture"></span><span class="orbit-node orbit-node--decision-a"></span>
        <span class="orbit-node orbit-node--decision-b"></span><span class="orbit-node orbit-node--ack"></span>
        <span class="coordinate coordinate--north">N 08</span><span class="coordinate coordinate--east">R03</span>
      </div>
      <figcaption id="atlas-caption">${escapeHtml(label)}</figcaption>
    </figure>
  `;
}

function landing(): string {
  const realNotice = new URLSearchParams(window.location.search).get("start") === "real"
    ? `<aside class="notice notice--warning" role="status"><strong>Real agency rooms are next.</strong> This M1 release is the safe sample room. Read the Studio plan below.</aside>`
    : "";

  return `
    <main id="main" tabindex="-1">
      <section class="hero" aria-labelledby="page-heading">
        <div class="hero__copy">
          <p class="eyebrow">Release room / sample mode</p>
          <h1 id="page-heading" tabindex="-1">Review an API handoff together.</h1>
          <p class="hero__lede">For agency teams handing an integration to a client, keep the sample, decisions, owners, and review in one room.</p>
          <div class="hero__actions"><a class="button button--primary" href="/demo">Try it with sample data</a><span class="action-note">Opens a payment-status handoff.</span></div>
          <ul class="plain-facts" aria-label="Product facts">
            <li>Sample changes stay in a separate browser space.</li><li>No live API calls run in this sample.</li><li>Studio is planned at $79/month per agency.</li>
          </ul>
        </div>
        <div class="hero__atlas">${orbitAtlas("The fixture is the center point. Decisions and acknowledgement orbit it as the handoff is reviewed.")}</div>
      </section>
      ${realNotice}
      <section class="preview-section section-rule" aria-labelledby="preview-heading">
        <div class="section-heading"><p class="eyebrow">Inside the sample room</p><h2 id="preview-heading">One release, one reference point.</h2><p>The room keeps the selected response, decision record, named owner, and review state in view.</p></div>
        <div class="room-preview" aria-label="Preview of the payment-status release room">
          <div class="room-preview__rail"><span class="status-chip status-chip--aqua">R03 selected</span><strong>Payment status release</strong><span>Northstar Market</span></div>
          <div class="room-preview__fixture"><span class="eyebrow">Sanitized fixture</span><strong>POST /v1/payment-status</strong><code>{ "status": "paid" }</code></div>
          <div class="room-preview__review"><span class="status-chip status-chip--warning">3 review steps</span><span>Decision owners are named.</span></div>
        </div>
      </section>
      <section id="how-it-works" class="how-it-works section-rule" aria-labelledby="how-heading">
        <div class="section-heading"><p class="eyebrow">How it works</p><h2 id="how-heading">Move from sample to review in three steps.</h2></div>
        <ol class="steps">
          <li><span>01</span><h3>Open a safe example.</h3><p>Start with a prepared request and response that contains no live credentials.</p></li>
          <li><span>02</span><h3>Check each decision.</h3><p>Read the agreement, owner, and remaining confirmation beside the fixture.</p></li>
          <li><span>03</span><h3>Record the review.</h3><p>Complete the checklist, enter a name, and export the sample handover record.</p></li>
        </ol>
      </section>
      <section class="boundary-section section-rule" aria-labelledby="boundary-heading">
        <div><p class="eyebrow">Clear boundary</p><h2 id="boundary-heading">It is not a test runner or a contract.</h2></div>
        <p>This sample does not send API requests. Its acknowledgement records a review; it is not a legal signature.</p><a href="/privacy">Read the privacy boundary</a>
      </section>
      <section id="pricing" class="pricing section-rule" aria-labelledby="pricing-heading">
        <div><p class="eyebrow">Studio</p><h2 id="pricing-heading">$79 USD per agency, each month.</h2><p>Agency rooms, private reviewers, and exports are planned for the Studio release. Client reviewers remain free.</p></div>
        <a class="button button--secondary" href="/demo">Try the free sample</a>
      </section>
    </main>
  `;
}

function demoBanner(): string {
  return `<aside class="demo-banner" aria-label="Demo mode"><p><strong>Demo — sample data, nothing is saved to a real room.</strong> Reset any time.</p><div><button class="button button--quiet" type="button" data-action="reset-demo">Reset demo</button><a href="/?start=real#pricing">Start for real</a></div></aside>`;
}

function demoRoom(state: DemoState): string {
  const fixture = state.room.fixture;
  const completed = completedRequiredCount(state);
  const required = requiredCount(state);
  const acknowledged = state.acknowledgement;
  const acknowledgementStatus = acknowledged
    ? `<div class="receipt" data-testid="acknowledgement-receipt" role="status"><span class="status-chip status-chip--success">Acknowledged</span><p><strong>${escapeHtml(acknowledged.reviewerName)}</strong> recorded an acknowledgement on ${escapeHtml(formatDate(acknowledged.acknowledgedAt))} UTC for revision ${escapeHtml(acknowledged.revisionId)}.</p><p>This records a review. It is not a contract or legal signature.</p></div>`
    : `<p id="ack-status" class="ack-status">Complete ${completed} of ${required} required steps to record the review.</p>`;
  const checklist = state.room.checklist.map((item) => `<li><label class="check-item"><input type="checkbox" data-check-id="${escapeHtml(item.id)}" ${item.completed ? "checked" : ""} ${acknowledged ? "disabled" : ""} /><span>${escapeHtml(item.label)} <em>Required</em></span></label></li>`).join("");
  const decisions = state.room.decisions.map((decision) => `<li class="decision"><div><span class="status-chip ${decision.status === "Decided" ? "status-chip--success" : "status-chip--warning"}">${escapeHtml(decision.status)}</span><h3>${escapeHtml(decision.title)}</h3></div><p>${escapeHtml(decision.detail)}</p><p class="owner-line"><strong>${escapeHtml(decision.owner)}</strong> · ${escapeHtml(decision.role)}<br /><span>${escapeHtml(decision.dueDate)}</span></p></li>`).join("");
  const canSubmit = !acknowledged && completed === required;
  return `
    <main id="main" tabindex="-1">
      ${demoBanner()}
      <section class="room-title" aria-labelledby="page-heading"><div><p class="eyebrow">Demo room / ${escapeHtml(state.room.release)}</p><h1 id="page-heading" tabindex="-1">Review the payment-status handoff.</h1><p>${escapeHtml(state.room.client)} · ${escapeHtml(state.room.reviewer)}</p></div><span class="status-chip status-chip--warning">Awaiting review</span></section>
      <section class="room-layout" aria-label="Sample handoff room">
        <aside class="room-rail" aria-labelledby="release-map-heading"><div><p class="eyebrow">Release map</p><h2 id="release-map-heading">${escapeHtml(state.room.title)}</h2><p>${escapeHtml(state.room.release)}</p></div><button class="fixture-select" type="button" data-action="select-fixture" aria-pressed="true"><span class="fixture-select__dot" aria-hidden="true"></span><span><strong>${escapeHtml(fixture.title)}</strong><small>Selected fixture</small></span></button>${orbitAtlas("Selected fixture links to two decisions and the final acknowledgement.")}</aside>
        <section class="fixture-panel" aria-labelledby="fixture-heading"><div class="panel-heading"><div><p class="eyebrow">Selected fixture</p><h2 id="fixture-heading">${escapeHtml(fixture.title)}</h2></div><span class="status-chip status-chip--aqua">Sanitized sample</span></div><p class="fixture-path"><strong>${escapeHtml(fixture.method)}</strong> ${escapeHtml(fixture.path)}</p><div class="redaction-report" role="status"><strong>Redaction report</strong><span>${escapeHtml(fixture.redactions[0] ?? "Prepared sample is safe to review.")}</span></div><div class="payload-toolbar"><h3 id="payload-heading">Request and response</h3><button class="button button--quiet" type="button" data-action="copy-payload">Copy sample</button></div><pre class="payload" aria-labelledby="payload-heading"><code>${escapeHtml(fixturePayload(fixture))}</code></pre><p class="inline-status" aria-live="polite" data-testid="copy-status"></p></section>
        <aside class="review-panel"><section aria-labelledby="checklist-heading"><div class="panel-heading"><div><p class="eyebrow">Acceptance</p><h2 id="checklist-heading">Checklist</h2></div><span class="status-chip status-chip--warning">${completed}/${required} required</span></div><p id="checklist-count" class="sr-only">${completed} of ${required} required checklist items complete.</p><ul class="checklist" aria-describedby="checklist-count">${checklist}</ul></section><section class="decision-ledger" aria-labelledby="decisions-heading"><div class="panel-heading"><div><p class="eyebrow">Agreement record</p><h2 id="decisions-heading">Decisions and owners</h2></div></div><ol>${decisions}</ol></section></aside>
      </section>
      <section class="acknowledgement-plane" aria-labelledby="acknowledgement-heading"><div><p class="eyebrow">Review record / revision ${escapeHtml(state.room.revisionId)}</p><h2 id="acknowledgement-heading">Record the client review.</h2><p>Use a name only after the required steps are complete. This is a review record, not a contract.</p>${acknowledgementStatus}</div>${acknowledged ? `<div class="export-control"><button class="button button--primary" type="button" data-action="export-handover">Download handover JSON</button><p id="export-status" aria-live="polite"></p></div>` : `<form class="acknowledgement-form" data-form="acknowledgement"><label for="reviewer-name">Reviewer name</label><input id="reviewer-name" name="reviewerName" autocomplete="name" required maxlength="80" placeholder="Enter your name" /><label class="confirm-check"><input id="acknowledgement-confirm" type="checkbox" name="confirmed" required /> <span>I reviewed revision ${escapeHtml(state.room.revisionId)} and understand this is not a contract.</span></label><button class="button button--primary" type="submit" ${canSubmit ? "" : "disabled"}>Record acknowledgement</button><p class="form-error" role="alert" aria-live="assertive"></p></form>`}</section>
    </main>
  `;
}

function privacy(): string {
  return `<main id="main" tabindex="-1" class="document-page"><p class="eyebrow">Privacy</p><h1 id="page-heading" tabindex="-1">Your sample stays separate.</h1><p class="document-lede">The M1 demo is a browser-only sample. It exists so you can try the handoff flow without creating an account.</p><section><h2>What the sample stores</h2><p>The demo saves its seeded room, checklist changes, and acknowledgement under a browser key beginning with <code>demo:</code>. Reset demo replaces that sample with a fresh copy.</p></section><section><h2>What the sample does not send</h2><p>The demo does not call a live API, send fixtures to a server, or load third-party analytics, fonts, or scripts.</p></section><section><h2>When real rooms arrive</h2><p>Agency rooms will require sign-in and server storage. Before that release, this page will state the data types, retention, export, deletion, and billing terms in plain words.</p></section><p><a href="/terms">Read the terms</a></p></main>`;
}

function terms(): string {
  return `<main id="main" tabindex="-1" class="document-page"><p class="eyebrow">Terms</p><h1 id="page-heading" tabindex="-1">The sample records a review, not a contract.</h1><p class="document-lede">This M1 release is a free sample room for trying the handoff flow.</p><section><h2>Sample use</h2><p>Use the sample data only. Do not place credentials, client data, or legal records in this browser demo.</p></section><section><h2>Acknowledgement</h2><p>A named acknowledgement says the reviewer completed the displayed sample checklist. It is not an e-signature, legal approval, or substitute for a contract.</p></section><section><h2>Planned Studio service</h2><p>Studio is planned at $79 USD per agency each month. Hosted checkout, subscription terms, cancellation, and real-room access will be published before Studio opens.</p></section><p><a href="/privacy">Read the privacy boundary</a></p></main>`;
}

function notFound(): string {
  return `<main id="main" tabindex="-1" class="not-found"><p class="eyebrow">Coordinate not found</p><h1 id="page-heading" tabindex="-1">This coordinate is unknown.</h1><p>The room or page you requested is not on this release map.</p><a class="button button--primary" href="/">Return to the release map</a></main>`;
}

function pageMarkup(page: AppPage): string {
  switch (page) {
    case "/": return landing();
    case "/demo": demoState ??= loadDemoState(); return demoRoom(demoState);
    case "/privacy": return privacy();
    case "/terms": return terms();
    case "/404": return notFound();
  }
}

function render(focusHeading = false): void {
  const page = pageForLocation(window.location.pathname, window.location.search);
  updateMetadata(page);
  appRoot.innerHTML = `${header(page)}${pageMarkup(page)}${footer()}<p class="route-announcer" aria-live="polite" aria-atomic="true">${escapeHtml(statusMessage)}</p>`;
  statusMessage = "";
  if (focusHeading || shouldFocusHeading) {
    document.querySelector<HTMLElement>("h1")?.focus();
    shouldFocusHeading = false;
  }
}

function routeTo(url: URL): void {
  window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  shouldFocusHeading = true;
  render();
  if (url.hash) window.setTimeout(() => document.getElementById(url.hash.slice(1))?.scrollIntoView(), 0);
  else window.scrollTo({ top: 0, behavior: "auto" });
}

function handleLinkClick(event: MouseEvent): boolean {
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!link || link.target === "_blank" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const url = new URL(link.href);
  if (url.origin !== window.location.origin) return false;
  const current = new URL(window.location.href);
  if (url.pathname === current.pathname && url.search === current.search && url.hash) return false;
  event.preventDefault();
  routeTo(url);
  return true;
}

async function copyFixture(): Promise<void> {
  if (!demoState) return;
  const status = document.querySelector<HTMLElement>("[data-testid='copy-status']");
  try {
    await navigator.clipboard.writeText(fixturePayload(demoState.room.fixture));
    if (status) status.textContent = "Sample copied to the clipboard.";
  } catch {
    if (status) status.textContent = "Could not copy the sample. Select the text in the payload instead.";
  }
}

function exportHandover(): void {
  if (!demoState) return;
  const status = document.querySelector<HTMLElement>("#export-status");
  try {
    const blob = new Blob([`${JSON.stringify(createHandoverRecord(demoState), null, 2)}\n`], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = "payment-status-handover-R03.json";
    link.addEventListener("click", (event) => event.stopPropagation());
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    if (status) status.textContent = "Handover JSON downloaded.";
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : "Could not create the handover export.";
  }
}

document.addEventListener("click", (event) => {
  if (handleLinkClick(event)) return;
  const control = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-action]") : null;
  if (!control) return;
  const action = control.dataset.action;
  if (action === "toggle-theme") {
    const dayChart = document.documentElement.dataset.theme !== "day";
    document.documentElement.dataset.theme = dayChart ? "day" : "";
    control.setAttribute("aria-pressed", String(dayChart));
    control.textContent = dayChart ? "Night chart" : "Day chart";
  }
  if (action === "reset-demo") {
    demoState = resetDemoState();
    statusMessage = "Demo reset. The payment-status room is fresh again.";
    render();
  }
  if (action === "select-fixture") {
    statusMessage = "Payment status — paid response is selected.";
    render();
  }
  if (action === "copy-payload") void copyFixture();
  if (action === "export-handover") exportHandover();
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.dataset.checkId || !demoState) return;
  demoState = setChecklistItem(demoState, target.dataset.checkId, target.checked);
  saveDemoState(demoState);
  render();
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.dataset.form !== "acknowledgement" || !demoState) return;
  event.preventDefault();
  const values = new FormData(form);
  const name = String(values.get("reviewerName") ?? "");
  const confirmed = values.get("confirmed") === "on";
  const error = form.querySelector<HTMLElement>(".form-error");
  if (!canAcknowledge(demoState, name, confirmed)) {
    if (error) error.textContent = "Complete every required step, enter your name, and confirm the review.";
    return;
  }
  demoState = acknowledgeDemo(demoState, name);
  saveDemoState(demoState);
  statusMessage = `Acknowledgement recorded for ${name.trim()}.`;
  render();
});

window.addEventListener("popstate", () => {
  shouldFocusHeading = true;
  render();
});

render();
