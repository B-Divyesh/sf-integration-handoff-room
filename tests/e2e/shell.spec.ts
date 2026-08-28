import { expect, test } from "@playwright/test";

test("the scaffold loads an accessible route shell without console errors", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/");

  await expect(page).toHaveTitle("Integration Handoff Room — client API handoffs");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("h1")).toHaveText("The handoff room is being prepared.");
  expect(consoleErrors).toEqual([]);
});
