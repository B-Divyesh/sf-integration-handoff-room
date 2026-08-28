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

test("the demo has no serious or critical axe violations", async ({ page }) => {
  for (const route of ["/", "/demo", "/privacy", "/terms", "/unknown-coordinate"]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrCritical = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(seriousOrCritical, `${route} has no serious or critical axe violations`).toEqual([]);
  }
});

test("the demo stays usable at a 390px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Payment status — paid response" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("public routes have their own title, heading, and no console errors", async ({ page }) => {
  const routes = [
    ["/", "Integration Handoff Room — client API handoffs", "Review an API handoff together."],
    ["/privacy", "Privacy — Integration Handoff Room", "Your sample stays separate."],
    ["/terms", "Terms — Integration Handoff Room", "The sample records a review, not a contract."],
    ["/unknown-coordinate", "Page not found — Integration Handoff Room", "This coordinate is unknown."]
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
