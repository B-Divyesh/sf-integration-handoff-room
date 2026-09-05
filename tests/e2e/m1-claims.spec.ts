import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function completeSampleReview(page: Page, reviewerName = "Taylor Reed"): Promise<void> {
  const checklist = page.locator("[data-check-id]");
  for (let index = 0; index < await checklist.count(); index += 1) {
    await checklist.nth(index).check();
  }
  await page.getByLabel("Reviewer name").fill(reviewerName);
  await page.getByLabel(/I reviewed revision R03/).check();
  await page.getByRole("button", { name: "Record acknowledgement" }).click();
  await expect(page.getByTestId("acknowledgement-receipt")).toContainText(reviewerName);
}

test("@claim:demo-sample-room sample data opens a realistic payment API handoff room", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/demo");

  await expect(page).toHaveTitle("Demo — Integration Handoff Room");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Review the payment-status handoff.");
  await expect(page.getByRole("heading", { name: "Payment status — paid response" })).toBeVisible();
  await expect(page.getByText("Northstar Market")).toBeVisible();
  await expect(page.getByText("Sanitized sample")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("@claim:demo-acknowledgement a reviewer can record a named acknowledgement in the sample room", async ({ page }) => {
  await page.goto("/demo");
  await completeSampleReview(page, "Taylor Reed");

  await expect(page.getByTestId("acknowledgement-receipt")).toContainText(/recorded an acknowledgement on .+ UTC for revision R03/);
  await expect(page.getByText("This records a review. It is not a contract or legal signature.")).toBeVisible();
});

test("@claim:demo-handover-export exports the selected fixture, decisions, checklist, and acknowledgement", async ({ page }) => {
  await page.goto("/demo");
  await completeSampleReview(page, "Jordan Lee");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download handover JSON" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  if (!stream) throw new Error("The handover download did not provide a stream.");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const handover = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;

  expect(download.suggestedFilename()).toBe("payment-status-handover-R03.json");
  expect(handover).toHaveProperty("selected_fixture");
  expect(handover).toHaveProperty("decisions");
  expect(handover).toHaveProperty("checklist");
  expect(handover).toHaveProperty("acknowledgement");
  expect((handover.acknowledgement as { reviewerName: string }).reviewerName).toBe("Jordan Lee");
});

test("@claim:demo-isolated demo changes stay in a separate browser storage namespace", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto("/demo");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Reset demo" }).click();

  const storageKeys = await page.evaluate(() => Object.keys(localStorage));
  expect(storageKeys).toHaveLength(1);
  expect(storageKeys.every((key) => key.startsWith("demo:"))).toBe(true);
  expect(requests.every((requestUrl) => new URL(requestUrl).origin === new URL(page.url()).origin)).toBe(true);
});

test("@claim:demo-data-private demo interactions send no fixture or review data", async ({ page, context }) => {
  const sent: Array<{ method: string; url: string; body: string | null }> = [];
  page.on("request", (request) => sent.push({ method: request.method(), url: request.url(), body: request.postData() }));
  await page.goto("/demo");
  await completeSampleReview(page, "Privacy Reviewer");
  expect(sent.every((request) => request.method === "GET" && request.body === null)).toBe(true);
  expect(sent.every((request) => new URL(request.url).origin === new URL(page.url()).origin)).toBe(true);
  expect(await context.cookies()).toEqual([]);
  const stores = await page.evaluate(async () => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), indexedDb: "databases" in indexedDB ? (await indexedDB.databases()).map((database) => database.name) : [] }));
  expect(stores.local).toEqual(["demo:integration-handoff-room:sample-v1"]);
  expect(stores.session).toEqual([]);
  expect(stores.indexedDb).toEqual([]);
});

test("@claim:fixture-sanitized prepared sample contains no secret-like values", async ({ page }) => {
  await page.goto("/demo");
  const payload = await page.locator(".payload").textContent();
  expect(payload).not.toMatch(/bearer\s+\S+|basic\s+\S+|ghp_|github_pat_|sk-[a-z0-9]|api[_-]?key|password|private key|eyJ[a-zA-Z0-9_-]+\./i);
  await expect(page.getByText("No secret-like values found in this prepared sample.")).toBeVisible();
});

test("@claim:studio-hosted-checkout Studio never fakes checkout when Sociobot registration is unavailable", async ({ page }) => {
  await page.goto("/settings/billing");
  await expect(page.getByText("Studio checkout is not available yet because Sociobot has not registered the subscription product.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open hosted checkout" })).toHaveCount(0);
});

test("@claim:studio-price Studio shows the registered $79 monthly plan and hosted Sociobot checkout", async ({ page }) => {
  const checkoutUrl = "https://api.sociobot.in/api/v1/products/integration-handoff-room/checkout";
  await page.route("**/api/config", async (route) => route.fulfill({
    json: {
      tenant_id: "35c6fe40-0ec0-46b6-98c6-213ad4de6650",
      tenant_subdomain: "sociobotcustomers",
      client_id: "25c704f4-465a-47af-80ab-2c489466b697",
      authority: "https://sociobotcustomers.ciamlogin.com/35c6fe40-0ec0-46b6-98c6-213ad4de6650/",
      build_sha: "test-build",
      checkout_url: checkoutUrl,
      billing_registered: true,
      studio_price: "$79 USD per agency each month"
    }
  }));
  await page.goto("/settings/billing");
  await expect(page.getByText("Studio is $79 USD per agency each month when Sociobot registration is available.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open hosted checkout" })).toHaveAttribute("href", checkoutUrl);
});

test("@claim:agency-room-browser the real room browser flow imports only a selected GitHub repository, redacts, saves, and reloads", async ({ page }) => {
  const room = { id: "room-1", title: "Payment handoff", client_name: "Northstar", repository: "atlas/payments", release_ref: "v1.2.0", revision: 1, fixture: { authorization: "[REDACTED]", status: "paid" }, redaction_findings: ["Removed a secret-like value at $.authorization."], decisions: [{ text: "Retry stops after three checks.", owner: "Dara Singh", version: 1 }], checklist: [], questions: [], acknowledgement: null };
  await page.route("**/api/github/repositories", async (route) => route.fulfill({ json: { repositories: [{ connection_id: "connection-1", full_name: "atlas/payments", selected: true, private: true, github_login: "atlas" }] } }));
  await page.route("**/api/fixtures/import", async (route) => route.fulfill({ json: { repository: "atlas/payments", release_ref: "v1.2.0", path: "fixtures/payment.json", fixture: room.fixture, findings: room.redaction_findings } }));
  await page.route("**/api/rooms", async (route) => route.fulfill({ status: 201, json: room }));
  await page.route("**/api/rooms/room-1", async (route) => route.fulfill({ json: room }));
  await page.goto("/rooms/new");
  await page.getByLabel("Selected repository").selectOption("atlas/payments");
  await page.getByLabel("Release ref").fill("v1.2.0");
  await page.getByLabel("JSON file path").fill("fixtures/payment.json");
  await page.getByRole("button", { name: "Import and redact fixture" }).click();
  await expect(page.getByTestId("import-preview")).toContainText("[REDACTED]");
  await page.getByLabel("Room title").fill("Payment handoff");
  await page.getByLabel("Client name").fill("Northstar");
  await page.getByLabel("Decision", { exact: true }).fill("Retry stops after three checks.");
  await page.getByLabel("Decision owner").fill("Dara Singh");
  await page.getByLabel(/I reviewed the sanitized fixture/).check();
  await page.getByRole("button", { name: "Create client room" }).click();
  await expect(page).toHaveURL(/\/rooms\/room-1$/);
  await expect(page.getByRole("heading", { name: "Payment handoff" })).toBeVisible();
  await expect(page.getByText("Removed a secret-like value at $.authorization.")).toBeVisible();
});

test("@claim:github-selected-repository GitHub import has no raw owner/repository fields and requires a selected connection", async ({ page }) => {
  await page.route("**/api/github/repositories", async (route) => route.fulfill({ json: { repositories: [] } }));
  await page.goto("/rooms/new");
  await expect(page.getByLabel("Owner", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Selected repository")).toHaveValue("");
  await expect(page.getByRole("link", { name: "Connect GitHub and select it" })).toBeVisible();
});

test("@claim:agency-deletion signed-in agencies can permanently delete their workspace", async ({ page }) => {
  await page.route("**/api/agency", async (route) => {
    expect(route.request().method()).toBe("DELETE");
    expect(route.request().postDataJSON()).toEqual({ confirmation: "DELETE" });
    await route.fulfill({ json: { deleted: true } });
  });
  await page.goto("/settings/data");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete agency workspace" }).click();
  await expect(page).toHaveURL(/\/rooms$/);
  await expect(page.getByText("Agency workspace deleted.")).toBeVisible();
});

test("@claim:client-review-workflow a client can ask a question and acknowledge the scoped revision", async ({ page }) => {
  let questions: Array<Record<string, unknown>> = [];
  let acknowledgement: Record<string, unknown> | null = null;
  const response = () => ({ id: "room-1", title: "Payment handoff", client_name: "Northstar", repository: "atlas/payments", release_ref: "v1.2.0", revision: 1, fixture: { status: "paid" }, decisions: [{ text: "Retry stops after three checks.", owner: "Dara Singh", version: 1 }], checklist: [{ id: "fixture", label: "I reviewed the fixture." }, { id: "questions", label: "My questions are recorded." }], questions, acknowledgement });
  await page.route("**/api/review/private-token", async (route) => route.fulfill({ json: response() }));
  await page.route("**/api/review/private-token/questions", async (route) => { questions = [{ id: "q1", author_name: "Morgan", body: "When does retry stop?", answer: null }]; await route.fulfill({ status: 201, json: questions[0] }); });
  await page.route("**/api/review/private-token/acknowledgements", async (route) => { acknowledgement = { reviewer_name: "Morgan", revision: 1 }; await route.fulfill({ status: 201, json: acknowledgement }); });
  await page.goto("/review/private-token");
  await page.getByLabel("Your name").fill("Morgan");
  await page.getByRole("textbox", { name: "Question", exact: true }).fill("When does retry stop?");
  await page.getByRole("button", { name: "Save question" }).click();
  await expect(page.getByText("When does retry stop?", { exact: false })).toBeVisible();
  for (const checkbox of await page.locator("[data-real-check]").all()) await checkbox.check();
  await page.getByLabel("Reviewer name").fill("Morgan");
  await page.getByLabel(/I reviewed this revision/).check();
  await page.getByRole("button", { name: "Record acknowledgement" }).click();
  await expect(page.getByText("Acknowledged by Morgan")).toBeVisible();
});

test("the acknowledgement and export work with keyboard input only", async ({ page }) => {
  await page.goto("/demo");
  const checkboxes = page.getByRole("checkbox");
  for (let index = 0; index < 3; index += 1) {
    await checkboxes.nth(index).focus();
    await page.keyboard.press("Space");
  }
  await page.getByLabel("Reviewer name").focus();
  await page.keyboard.insertText("Keyboard Reviewer");
  await page.getByLabel(/I reviewed revision R03/).focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Record acknowledgement" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("acknowledgement-receipt")).toContainText("Keyboard Reviewer");
  await page.getByRole("button", { name: "Download handover JSON" }).focus();
  await expect(page.getByRole("button", { name: "Download handover JSON" })).toBeFocused();
});

test("public pages have no serious or critical axe violations in both themes", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const route of ["/", "/demo", "/privacy", "/terms", "/rooms", "/settings/billing"]) {
      await page.goto(route);
      for (const theme of ["night", "day"]) {
        if (theme === "day") await page.getByRole("button", { name: "Day chart" }).click();
        const results = await new AxeBuilder({ page }).analyze();
        const seriousOrCritical = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
        expect(seriousOrCritical, `${route} ${theme} ${viewport.width}px`).toEqual([]);
      }
    }
  }
});

test("the production server returns its designed 404 document", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // Chromium emits a console diagnostic for every top-level HTTP 404, including
  // a valid document. Page errors are the signal for a broken 404 experience.
  const response = await page.goto("/unknown-coordinate");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found — Integration Handoff Room");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This coordinate is unknown.");
  await expect(page.getByRole("link", { name: "Return to the release map" })).toHaveAttribute("href", "/");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("the demo stays usable at a 390px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payment status — paid response" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const undersized = await page.locator("a, button").evaluateAll((controls) => controls.filter((control) => {
    const box = control.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44);
  }).map((control) => `${control.tagName}:${control.textContent?.trim()}:${control.getBoundingClientRect().width}x${control.getBoundingClientRect().height}`));
  expect(undersized).toEqual([]);
});

test("the 390px landing first screen includes the action and three facts", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Try it with sample data" })).toBeVisible();
  const facts = page.locator(".plain-facts");
  await expect(facts).toBeVisible();
  expect((await facts.boundingBox())?.y ?? 900).toBeLessThan(844);
});

test("loaded sample remains usable when the browser goes offline", async ({ page, context }) => {
  await page.goto("/demo");
  await context.setOffline(true);
  await page.locator("[data-check-id]").first().check();
  await expect(page.locator("[data-check-id]").first()).toBeChecked();
  await expect(page.getByText("1/3 required")).toBeVisible();
});

test("reduced motion and 200 percent reflow keep the interface usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 640, height: 800 });
  await page.goto("/demo");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const duration = await page.getByRole("button", { name: "Reset demo" }).evaluate((button) => getComputedStyle(button).transitionDuration);
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.00001);
});

test("the real create-room page reflows at 390px without serious Axe findings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/rooms/new");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
});

test("public routes have their own title, heading, and no console errors", async ({ page }) => {
  const routes = [
    ["/", "Integration Handoff Room — client API handoffs", "Review an API handoff together."],
    ["/privacy", "Privacy — Integration Handoff Room", "Your sample stays separate."],
    ["/terms", "Terms — Integration Handoff Room", "A review is not a contract."]
  ] as const;
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  for (const [route, title, heading] of routes) {
    await page.goto(route);
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
  expect(consoleErrors).toEqual([]);
});

test("the day chart preference remains clear after navigation", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Day chart" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "day");
  await page.getByRole("link", { name: "Privacy", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Night chart" })).toHaveAttribute("aria-pressed", "true");
});
