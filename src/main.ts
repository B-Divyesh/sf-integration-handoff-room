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
import { api, ApiError } from "./api";
import { currentAccount, initializeIdentity, productConfig, signIn, signOut } from "./auth";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("The application root is missing.");
}

const appRoot = app;
const SITE_ORIGIN = "https://integration-handoff-room.sociobot.in";
const BUILD_SHA = import.meta.env.VITE_BUILD_SHA || "dev";
let demoState: DemoState | undefined;
let statusMessage = "";
let shouldFocusHeading = false;
let currentRoom: Record<string, unknown> | undefined;
let importedFixture: Record<string, unknown> | undefined;
let importedFindings: string[] = [];

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
  const dayChart = document.documentElement.dataset.theme === "day";
  return `
    <a class="skip-link" href="#main">Skip to main content</a>
    <header class="site-header">
      <a class="wordmark" href="/" aria-label="Integration Handoff Room home">
        <span class="wordmark-mark" aria-hidden="true"></span>
        <span>Integration Handoff Room</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="/demo"${page === "/demo" ? ' aria-current="page"' : ""}>Demo</a>
        <a href="/rooms"${page === "/rooms" || page === "/room" || page === "/rooms/new" ? ' aria-current="page"' : ""}>Rooms</a>
        <a href="/privacy"${page === "/privacy" ? ' aria-current="page"' : ""}>Privacy</a>
        ${currentAccount() ? '<button class="nav-action" type="button" data-action="sign-out">Sign out</button>' : '<a href="/rooms">Sign in</a>'}
        <button class="theme-toggle" type="button" data-action="toggle-theme" aria-pressed="${dayChart}">${dayChart ? "Night chart" : "Day chart"}</button>
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
      <p>Built by Param Factory · build ${escapeHtml(BUILD_SHA.slice(0, 12))}</p>
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
  return `
    <main id="main" tabindex="-1">
      <section class="hero" aria-labelledby="page-heading">
        <div class="hero__copy">
          <p class="eyebrow">Release room / sample mode</p>
          <h1 id="page-heading" tabindex="-1">Review an API handoff together.</h1>
          <p class="hero__lede">For agency teams handing an integration to a client, keep the sample, decisions, owners, and review in one room.</p>
          <div class="hero__actions"><a class="button button--primary" href="/demo">Try it with sample data</a><a class="button button--secondary" href="/rooms">Create a real room</a><span class="action-note">The sample opens now. Real rooms use sign-in.</span></div>
          <ul class="plain-facts" aria-label="Product facts">
            <li>Sample changes stay in a separate browser space.</li><li>The sample sends no fixture data.</li><li>Studio costs $79/month per agency.</li>
          </ul>
        </div>
        <div class="hero__atlas">${orbitAtlas("The fixture is the center point. Decisions and acknowledgement orbit it as the handoff is reviewed.")}</div>
      </section>
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
        <p>The sample sends no fixture or review data. Its acknowledgement records a review; it is not a legal signature.</p><a href="/privacy">Read the privacy boundary</a>
      </section>
      <section id="pricing" class="pricing section-rule" aria-labelledby="pricing-heading">
        <div><p class="eyebrow">Studio</p><h2 id="pricing-heading">$79 USD per agency, each month.</h2><p>Studio includes agency rooms, private reviewers, GitHub fixture import, and exports. Client reviewers remain free.</p></div>
        <a class="button button--secondary" href="/settings/billing">Open Studio billing</a>
      </section>
    </main>
  `;
}

function demoBanner(): string {
  return `<aside class="demo-banner" aria-label="Demo mode"><p><strong>Demo — sample data, nothing is saved to a real room.</strong> Reset any time.</p><div><button class="button button--quiet" type="button" data-action="reset-demo">Reset demo</button><a href="/rooms">Start for real</a></div></aside>`;
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
        <section class="fixture-panel" aria-labelledby="fixture-heading"><div class="panel-heading"><div><p class="eyebrow">Selected fixture</p><h2 id="fixture-heading">${escapeHtml(fixture.title)}</h2></div><span class="status-chip status-chip--aqua">Sanitized sample</span></div><p class="fixture-path"><strong>${escapeHtml(fixture.method)}</strong> ${escapeHtml(fixture.path)}</p><div class="redaction-report" role="status"><strong>Redaction report</strong><span>${escapeHtml(fixture.redactions[0] ?? "Prepared sample is safe to review.")}</span></div><div class="payload-toolbar"><h3 id="payload-heading">Request and response</h3><button class="button button--quiet" type="button" data-action="copy-payload">Copy sample</button></div><pre class="payload" tabindex="0" aria-labelledby="payload-heading"><code>${escapeHtml(fixturePayload(fixture))}</code></pre><p class="inline-status" aria-live="polite" data-testid="copy-status"></p></section>
        <aside class="review-panel"><section aria-labelledby="checklist-heading"><div class="panel-heading"><div><p class="eyebrow">Acceptance</p><h2 id="checklist-heading">Checklist</h2></div><span class="status-chip status-chip--warning">${completed}/${required} required</span></div><p id="checklist-count" class="sr-only">${completed} of ${required} required checklist items complete.</p><ul class="checklist" aria-describedby="checklist-count">${checklist}</ul></section><section class="decision-ledger" aria-labelledby="decisions-heading"><div class="panel-heading"><div><p class="eyebrow">Agreement record</p><h2 id="decisions-heading">Decisions and owners</h2></div></div><ol>${decisions}</ol></section></aside>
      </section>
      <section class="acknowledgement-plane" aria-labelledby="acknowledgement-heading"><div><p class="eyebrow">Review record / revision ${escapeHtml(state.room.revisionId)}</p><h2 id="acknowledgement-heading">Record the client review.</h2><p>Use a name only after the required steps are complete. This is a review record, not a contract.</p>${acknowledgementStatus}</div>${acknowledged ? `<div class="export-control"><button class="button button--primary" type="button" data-action="export-handover">Download handover JSON</button><p id="export-status" aria-live="polite"></p></div>` : `<form class="acknowledgement-form" data-form="acknowledgement"><label for="reviewer-name">Reviewer name</label><input id="reviewer-name" name="reviewerName" autocomplete="name" required maxlength="80" placeholder="Enter your name" /><label class="confirm-check"><input id="acknowledgement-confirm" type="checkbox" name="confirmed" required /> <span>I reviewed revision ${escapeHtml(state.room.revisionId)} and understand this is not a contract.</span></label><button class="button button--primary" type="submit" ${canSubmit ? "" : "disabled"}>Record acknowledgement</button><p class="form-error" role="alert" aria-live="assertive"></p></form>`}</section>
    </main>
  `;
}

function privacy(): string {
  return `<main id="main" tabindex="-1" class="document-page"><p class="eyebrow">Privacy</p><h1 id="page-heading" tabindex="-1">Your sample stays separate.</h1><p class="document-lede">The demo is a browser-only sample. Real rooms use your Sociobot account and private server storage.</p><section><h2>What the sample stores</h2><p>The demo saves its room, checklist, and acknowledgement in one local key beginning with <code>demo:</code>. Reset demo replaces it.</p></section><section><h2>What the sample does not send</h2><p>The demo sends no fixture, checklist, or acknowledgement data. It uses no cookies, analytics, third-party fonts, or third-party scripts.</p></section><section><h2>What real rooms store</h2><p>Real rooms store your agency name, selected repository reference, sanitized fixture, questions, and acknowledgement. They never store the imported secret-like values removed by the redaction step.</p><p>Agency members can download each room export. Contact the site operator to delete an agency workspace while self-service deletion is prepared.</p></section><section><h2>Sign-in and checkout</h2><p>Microsoft Entra handles sign-in. Sociobot handles hosted checkout. This product does not receive your password or card details.</p></section><p><a href="/terms">Read the terms</a></p></main>`;
}

function terms(): string {
  return `<main id="main" tabindex="-1" class="document-page"><p class="eyebrow">Terms</p><h1 id="page-heading" tabindex="-1">A review is not a contract.</h1><p class="document-lede">Use the sample for evaluation. Use real rooms only for fixtures you are allowed to share with the invited client.</p><section><h2>Acknowledgement</h2><p>A named acknowledgement says the reviewer completed the displayed checklist for one revision. It is not an e-signature, legal approval, or substitute for a contract.</p></section><section><h2>Studio subscription</h2><p>Studio costs $79 USD per agency each month. Client reviewers are free. Sociobot handles checkout, cancellation, refunds, and payment records.</p><p>Cancelled agencies keep read and export access to existing rooms. Creating new rooms requires an active subscription after the pilot period.</p></section><section><h2>Repository use</h2><p>The importer reads only the public GitHub JSON file you select. You must review the sanitized result before saving a room.</p></section><p><a href="/privacy">Read the privacy boundary</a></p></main>`;
}

function signedOutPanel(): string {
  return `<section class="access-plane" aria-labelledby="access-heading"><p class="eyebrow">Sociobot account</p><h2 id="access-heading">Sign in to manage agency rooms.</h2><p>Agency data is shared and private, so real rooms use the Sociobot Microsoft sign-in.</p><button class="button button--primary" type="button" data-action="sign-in">Sign in with Microsoft</button><p class="form-error" role="alert" aria-live="assertive"></p></section>`;
}

function roomsPage(): string {
  return `<main id="main" tabindex="-1" class="workspace-page"><div class="workspace-heading"><div><p class="eyebrow">Agency workspace</p><h1 id="page-heading" tabindex="-1">Prepare a client handoff room.</h1><p>Import one safe GitHub fixture, share a private review link, and preserve the client response.</p></div>${currentAccount() ? '<a class="button button--primary" href="/rooms/new">Create a room</a>' : ""}</div><div id="workspace-content" aria-live="polite">${currentAccount() ? '<p class="loading-state">Loading your agency rooms…</p>' : signedOutPanel()}</div></main>`;
}

function newRoomPage(): string {
  if (!currentAccount()) return `<main id="main" tabindex="-1" class="workspace-page"><p class="eyebrow">Create a room</p><h1 id="page-heading" tabindex="-1">Connect a release fixture.</h1>${signedOutPanel()}</main>`;
  return `<main id="main" tabindex="-1" class="workspace-page"><p class="eyebrow">New room</p><h1 id="page-heading" tabindex="-1">Connect a release fixture.</h1><p class="document-lede">Choose one JSON file from a public GitHub repository. The server removes secret-like values before saving it.</p>
    <div class="prepare-grid">
      <form class="instrument-form" data-form="import-fixture"><h2>1. Import from GitHub</h2><div class="form-grid"><label>Owner<input name="owner" required maxlength="160" autocomplete="off" /></label><label>Repository<input name="repository" required maxlength="160" autocomplete="off" /></label><label>Release ref<input name="gitRef" value="main" required maxlength="160" autocomplete="off" /></label><label>JSON file path<input name="path" required maxlength="240" autocomplete="off" placeholder="fixtures/payment.json" /></label></div><button class="button button--secondary" type="submit">Import and redact fixture</button><p class="form-status" role="status" aria-live="polite"></p><p class="form-error" role="alert" aria-live="assertive"></p></form>
      <section class="fixture-preview" aria-labelledby="import-preview-heading"><h2 id="import-preview-heading">2. Review redaction</h2><div data-testid="import-preview"><p>Imported fixture and redaction findings will appear here.</p></div></section>
      <form class="instrument-form" data-form="create-room"><h2>3. Record the release decision</h2><div class="form-grid"><label>Room title<input name="title" required maxlength="120" /></label><label>Client name<input name="clientName" required maxlength="120" /></label><label>Decision<textarea name="decision" required maxlength="1000" placeholder="Pending status retries stop after three checks."></textarea></label><label>Decision owner<input name="decisionOwner" required maxlength="120" placeholder="Dara Singh · Agency API lead" /></label></div><label class="confirm-check"><input name="redactionConfirmed" type="checkbox" required /><span>I reviewed the sanitized fixture and redaction report.</span></label><button class="button button--primary" type="submit" disabled data-testid="create-real-room">Create client room</button><p class="form-error" role="alert" aria-live="assertive"></p></form>
    </div></main>`;
}

function roomPage(): string {
  return `<main id="main" tabindex="-1" class="workspace-page"><p class="eyebrow">Agency room</p><h1 id="page-heading" tabindex="-1">Manage this client handoff.</h1><div id="room-content" aria-live="polite">${currentAccount() ? '<p class="loading-state">Loading the room…</p>' : signedOutPanel()}</div></main>`;
}

function reviewPage(): string {
  return `<main id="main" tabindex="-1" class="workspace-page review-page"><p class="eyebrow">Private client review</p><h1 id="page-heading" tabindex="-1">Review this API handoff.</h1><div id="review-content" aria-live="polite"><p class="loading-state">Opening the shared room…</p></div></main>`;
}

function billingPage(): string {
  const checkout = productConfig()?.checkout_url ?? "https://api.sociobot.in/api/v1/products/integration-handoff-room/checkout";
  return `<main id="main" tabindex="-1" class="document-page"><p class="eyebrow">Studio billing</p><h1 id="page-heading" tabindex="-1">Start Studio through Sociobot.</h1><p class="document-lede">Studio costs $79 USD per agency each month. Client reviewers remain free.</p><section><h2>What Studio includes</h2><p>Studio includes persistent agency rooms, GitHub fixture import, private client links, questions, acknowledgements, and exports.</p><a class="button button--primary" href="${escapeHtml(checkout)}">Open hosted checkout</a></section><section><h2>Billing boundary</h2><p>Sociobot is the merchant of record. Payment details are handled on its hosted checkout, not by this product.</p><p><a href="/terms">Read subscription terms</a></p></section></main>`;
}

function callbackPage(): string {
  return `<main id="main" tabindex="-1" class="document-page"><p class="eyebrow">Sociobot account</p><h1 id="page-heading" tabindex="-1">Your sign-in is complete.</h1><p>${currentAccount() ? "Return to your agency rooms to continue." : "Sign-in could not be completed. Return to rooms and try again."}</p><a class="button button--primary" href="/rooms">Open agency rooms</a></main>`;
}

function textValue(value: unknown): string { return typeof value === "string" ? value : ""; }
function arrayValue(value: unknown): Array<Record<string, unknown>> { return Array.isArray(value) ? value as Array<Record<string, unknown>> : []; }

function renderRooms(data: Record<string, unknown>): void {
  const target = document.querySelector<HTMLElement>("#workspace-content");
  if (!target) return;
  const rooms = arrayValue(data.rooms);
  target.innerHTML = rooms.length ? `<ul class="room-list">${rooms.map((room) => `<li><a href="/rooms/${escapeHtml(textValue(room.id))}"><strong>${escapeHtml(textValue(room.title))}</strong><span>${escapeHtml(textValue(room.client_name))} · ${escapeHtml(textValue(room.repository))} · revision ${escapeHtml(String(room.revision ?? 1))}</span></a></li>`).join("")}</ul>` : `<section class="empty-state"><h2>No client rooms yet</h2><p>Your connected fixtures and review status will appear here.</p><a class="button button--primary" href="/rooms/new">Create your first room</a></section>`;
}

function renderAgencySetup(message = "Name the agency that owns these rooms."): void {
  const target = document.querySelector<HTMLElement>("#workspace-content");
  if (!target) return;
  target.innerHTML = `<form class="instrument-form agency-setup" data-form="agency"><h2>Set up your agency</h2><p>${escapeHtml(message)}</p><label for="agency-name">Agency name</label><input id="agency-name" name="agencyName" required maxlength="100" /><button class="button button--primary" type="submit">Create agency workspace</button><p class="form-error" role="alert" aria-live="assertive"></p></form>`;
}

function renderRoom(room: Record<string, unknown>): void {
  currentRoom = room;
  const target = document.querySelector<HTMLElement>("#room-content");
  if (!target) return;
  const findings = Array.isArray(room.redaction_findings) ? room.redaction_findings as string[] : [];
  const questions = arrayValue(room.questions);
  const decisions = arrayValue(room.decisions);
  target.innerHTML = `<section class="real-room-summary"><div><p class="eyebrow">Revision ${escapeHtml(String(room.revision ?? 1))}</p><h2>${escapeHtml(textValue(room.title))}</h2><p>${escapeHtml(textValue(room.client_name))} · ${escapeHtml(textValue(room.repository))} @ ${escapeHtml(textValue(room.release_ref))}</p></div><div class="room-actions"><button class="button button--primary" type="button" data-action="create-invite">Create private review link</button><button class="button button--secondary" type="button" data-action="export-real-room">Download room export</button></div><p class="form-status" data-testid="invite-status" role="status" aria-live="polite"></p></section>
    <section class="real-room-grid"><div><h2>Sanitized fixture</h2><div class="redaction-report"><strong>Redaction report</strong><span>${findings.length ? findings.map(escapeHtml).join(" ") : "No secret-like values were found."}</span></div><pre class="payload" tabindex="0"><code>${escapeHtml(JSON.stringify(room.fixture, null, 2))}</code></pre><h2>Release decisions</h2><ol class="question-list">${decisions.map((decision) => `<li><p>${escapeHtml(textValue(decision.text))}</p><p><strong>Owner:</strong> ${escapeHtml(textValue(decision.owner))} · version ${escapeHtml(String(decision.version ?? 1))}</p></li>`).join("")}</ol></div><div><h2>Client questions</h2>${questions.length ? `<ol class="question-list">${questions.map((question) => `<li><p><strong>${escapeHtml(textValue(question.author_name))}</strong>: ${escapeHtml(textValue(question.body))}</p>${question.answer ? `<p class="answer">Agency answer: ${escapeHtml(textValue(question.answer))}</p>` : `<form data-form="answer-question" data-question-id="${escapeHtml(textValue(question.id))}"><label>Answer<textarea name="answer" required maxlength="2000"></textarea></label><button class="button button--quiet" type="submit">Save answer</button><p class="form-error" role="alert"></p></form>`}</li>`).join("")}</ol>` : '<p>No client questions yet. They will appear here after you share a review link.</p>'}</div></section>`;
}

function renderReview(room: Record<string, unknown>): void {
  const target = document.querySelector<HTMLElement>("#review-content");
  if (!target) return;
  const checklist = arrayValue(room.checklist);
  const questions = arrayValue(room.questions);
  const decisions = arrayValue(room.decisions);
  const acknowledged = room.acknowledgement && typeof room.acknowledgement === "object" ? room.acknowledgement as Record<string, unknown> : undefined;
  target.innerHTML = `<section class="review-heading"><p class="eyebrow">Revision ${escapeHtml(String(room.revision ?? 1))}</p><h2>${escapeHtml(textValue(room.title))}</h2><p>Prepared for ${escapeHtml(textValue(room.client_name))} from ${escapeHtml(textValue(room.repository))}.</p></section><section class="real-room-grid"><div><h2>Sanitized fixture</h2><pre class="payload" tabindex="0"><code>${escapeHtml(JSON.stringify(room.fixture, null, 2))}</code></pre><h2>Decisions and owners</h2><ol class="question-list">${decisions.map((decision) => `<li><p>${escapeHtml(textValue(decision.text))}</p><p><strong>Owner:</strong> ${escapeHtml(textValue(decision.owner))} · version ${escapeHtml(String(decision.version ?? 1))}</p></li>`).join("")}</ol></div><div><h2>Review checklist</h2><ul class="checklist">${checklist.map((item) => `<li><label class="check-item"><input type="checkbox" data-real-check /><span>${escapeHtml(textValue(item.label))} <em>Required</em></span></label></li>`).join("")}</ul></div></section>
    <section class="review-conversation"><h2>Questions</h2>${questions.length ? `<ol class="question-list">${questions.map((question) => `<li><p><strong>${escapeHtml(textValue(question.author_name))}</strong>: ${escapeHtml(textValue(question.body))}</p>${question.answer ? `<p class="answer">Agency answer: ${escapeHtml(textValue(question.answer))}</p>` : '<p>Awaiting an agency answer.</p>'}</li>`).join("")}</ol>` : '<p>No questions have been asked.</p>'}<form class="instrument-form" data-form="ask-question"><h3>Ask about this release</h3><label>Your name<input name="authorName" required maxlength="80" autocomplete="name" /></label><label>Question<textarea name="body" required maxlength="1000"></textarea></label><button class="button button--secondary" type="submit">Save question</button><p class="form-error" role="alert" aria-live="assertive"></p></form></section>
    <section class="acknowledgement-plane"><div><p class="eyebrow">Revision ${escapeHtml(String(room.revision ?? 1))}</p><h2>Record this review.</h2><p>An acknowledgement records the displayed review. It is not a contract or legal signature.</p></div>${acknowledged ? `<div class="receipt"><strong>Acknowledged by ${escapeHtml(textValue(acknowledged.reviewer_name))}</strong><p>This receipt applies only to revision ${escapeHtml(String(acknowledged.revision ?? 1))}.</p></div>` : `<form class="acknowledgement-form" data-form="real-acknowledgement"><label>Reviewer name<input name="reviewerName" required maxlength="80" autocomplete="name" /></label><label class="confirm-check"><input name="confirmed" type="checkbox" required /><span>I reviewed this revision and understand this is not a contract.</span></label><button class="button button--primary" type="submit">Record acknowledgement</button><p class="form-error" role="alert" aria-live="assertive"></p></form>`}</section>`;
}

async function hydratePage(page: AppPage): Promise<void> {
  try {
    if (page === "/rooms" && currentAccount()) {
      try { renderRooms(await api<Record<string, unknown>>("/api/rooms")); }
      catch (error) { if (error instanceof ApiError && error.status === 403) renderAgencySetup(); else throw error; }
    }
    if (page === "/room" && currentAccount()) renderRoom(await api<Record<string, unknown>>(`/api/rooms/${encodeURIComponent(window.location.pathname.split("/").pop() ?? "")}`));
    if (page === "/review") renderReview(await api<Record<string, unknown>>(`/api/review/${encodeURIComponent(window.location.pathname.split("/").pop() ?? "")}`, {}, false));
  } catch (error) {
    const target = document.querySelector<HTMLElement>("#workspace-content, #room-content, #review-content");
    if (target) target.innerHTML = `<section class="error-state" role="alert"><h2>This page could not be opened</h2><p>${escapeHtml(error instanceof Error ? error.message : "Reload and try again.")}</p></section>`;
  }
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
    case "/rooms": return roomsPage();
    case "/rooms/new": return newRoomPage();
    case "/room": return roomPage();
    case "/review": return reviewPage();
    case "/settings/billing": return billingPage();
    case "/auth/callback": return callbackPage();
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
  void hydratePage(page);
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
  if (action === "sign-in") {
    void signIn().catch((error: unknown) => {
      const target = control.parentElement?.querySelector<HTMLElement>(".form-error");
      if (target) target.textContent = error instanceof Error ? error.message : "Sign-in could not start.";
    });
  }
  if (action === "sign-out") void signOut();
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
  if (action === "create-invite" && currentRoom) {
    const roomId = textValue(currentRoom.id);
    void api<{ review_url: string }>(`/api/rooms/${encodeURIComponent(roomId)}/invite`, { method: "POST", body: "{}" }).then((result) => {
      const target = document.querySelector<HTMLElement>("[data-testid='invite-status']");
      if (target) target.innerHTML = `Private review link: <a href="${escapeHtml(result.review_url)}">${escapeHtml(result.review_url)}</a>. It expires in seven days.`;
    }).catch((error: unknown) => {
      const target = document.querySelector<HTMLElement>("[data-testid='invite-status']");
      if (target) target.textContent = error instanceof Error ? error.message : "The review link could not be created.";
    });
  }
  if (action === "export-real-room" && currentRoom) {
    const roomId = textValue(currentRoom.id);
    void api<Record<string, unknown>>(`/api/rooms/${encodeURIComponent(roomId)}/export`).then((record) => {
      const objectUrl = URL.createObjectURL(new Blob([`${JSON.stringify(record, null, 2)}\n`], { type: "application/json" }));
      const link = document.createElement("a"); link.href = objectUrl; link.download = `${roomId}-handover.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    });
  }
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
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (form.dataset.form !== "acknowledgement") {
    void handleRealForm(form);
    return;
  }
  if (!demoState) return;
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

async function handleRealForm(form: HTMLFormElement): Promise<void> {
  const values = new FormData(form);
  const error = form.querySelector<HTMLElement>(".form-error");
  if (error) error.textContent = "";
  try {
    if (form.dataset.form === "agency") {
      await api("/api/me/bootstrap", { method: "POST", body: JSON.stringify({ agency_name: String(values.get("agencyName") ?? "") }) });
      renderRooms(await api<Record<string, unknown>>("/api/rooms"));
    }
    if (form.dataset.form === "import-fixture") {
      const result = await api<Record<string, unknown>>("/api/fixtures/import", { method: "POST", body: JSON.stringify({ owner: String(values.get("owner") ?? ""), repository: String(values.get("repository") ?? ""), git_ref: String(values.get("gitRef") ?? "main"), path: String(values.get("path") ?? "") }) });
      importedFixture = result.fixture as Record<string, unknown>;
      importedFindings = Array.isArray(result.findings) ? result.findings as string[] : [];
      importedFixture.__room_repository = result.repository;
      importedFixture.__room_release_ref = result.release_ref;
      const preview = document.querySelector<HTMLElement>("[data-testid='import-preview']");
      if (preview) preview.innerHTML = `<div class="redaction-report"><strong>${importedFindings.length} secret-like value${importedFindings.length === 1 ? "" : "s"} removed</strong><span>${importedFindings.length ? importedFindings.map(escapeHtml).join(" ") : "No secret-like values were found."}</span></div><pre class="payload" tabindex="0"><code>${escapeHtml(JSON.stringify(result.fixture, null, 2))}</code></pre>`;
      const createButton = document.querySelector<HTMLButtonElement>("[data-testid='create-real-room']");
      if (createButton) createButton.disabled = false;
      const status = form.querySelector<HTMLElement>(".form-status"); if (status) status.textContent = "Fixture imported and sanitized. Review the report before saving.";
    }
    if (form.dataset.form === "create-room") {
      if (!importedFixture) throw new Error("Import and review a GitHub fixture before creating the room.");
      const repository = String(importedFixture.__room_repository ?? ""); const releaseRef = String(importedFixture.__room_release_ref ?? "");
      const fixture = { ...importedFixture }; delete fixture.__room_repository; delete fixture.__room_release_ref;
      const room = await api<Record<string, unknown>>("/api/rooms", { method: "POST", body: JSON.stringify({ title: String(values.get("title") ?? ""), client_name: String(values.get("clientName") ?? ""), repository, release_ref: releaseRef, fixture, redaction_confirmed: values.get("redactionConfirmed") === "on", decisions: [{ text: String(values.get("decision") ?? ""), owner: String(values.get("decisionOwner") ?? "") }] }) });
      routeTo(new URL(`/rooms/${textValue(room.id)}`, window.location.origin));
    }
    if (form.dataset.form === "ask-question") {
      const token = window.location.pathname.split("/").pop() ?? "";
      await api(`/api/review/${encodeURIComponent(token)}/questions`, { method: "POST", body: JSON.stringify({ author_name: String(values.get("authorName") ?? ""), body: String(values.get("body") ?? "") }) }, false);
      renderReview(await api<Record<string, unknown>>(`/api/review/${encodeURIComponent(token)}`, {}, false));
    }
    if (form.dataset.form === "real-acknowledgement") {
      const checks = [...document.querySelectorAll<HTMLInputElement>("[data-real-check]")];
      const token = window.location.pathname.split("/").pop() ?? "";
      await api(`/api/review/${encodeURIComponent(token)}/acknowledgements`, { method: "POST", body: JSON.stringify({ reviewer_name: String(values.get("reviewerName") ?? ""), confirmed: values.get("confirmed") === "on", checklist_complete: checks.length > 0 && checks.every((check) => check.checked) }) }, false);
      renderReview(await api<Record<string, unknown>>(`/api/review/${encodeURIComponent(token)}`, {}, false));
    }
    if (form.dataset.form === "answer-question" && currentRoom) {
      const questionId = form.dataset.questionId ?? ""; const roomId = textValue(currentRoom.id);
      await api(`/api/rooms/${encodeURIComponent(roomId)}/questions/${encodeURIComponent(questionId)}/answer`, { method: "POST", body: JSON.stringify({ answer: String(values.get("answer") ?? "") }) });
      renderRoom(await api<Record<string, unknown>>(`/api/rooms/${encodeURIComponent(roomId)}`));
    }
  } catch (caught) {
    if (error) error.textContent = caught instanceof Error ? caught.message : "The request could not be completed.";
  }
}

window.addEventListener("popstate", () => {
  shouldFocusHeading = true;
  render();
});

if (window.location.pathname.startsWith("/rooms") || window.location.pathname === "/auth/callback") await initializeIdentity();
render();
