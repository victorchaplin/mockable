import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end happy path against the real Next.js server and a real SQLite
 * database. The LLM is replaced by MOCKABLE_LLM=mock (deterministic HTML), so
 * the prompt -> proposals -> pick -> refine -> edit -> add page -> share ->
 * walk -> revoke flow runs without network access or a real key.
 */

async function configureSettings(page: Page): Promise<void> {
  await page.goto("/settings");
  await page.getByLabel("Provider").selectOption("openai");
  await page.getByLabel("Model").fill("gpt-4o");
  await page.getByLabel("API key").fill("sk-e2e-browser-only");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toContainText(/saved/i);

  // The key is restored from localStorage on reload.
  await page.reload();
  await expect(page.getByLabel("API key")).toHaveValue("sk-e2e-browser-only");
  await expect(page.getByLabel("API key")).toHaveAttribute("type", "password");
}

test("full mocked-LLM happy path: propose, pick, refine, edit, grow, share, walk, revoke", async ({
  page,
}) => {
  await configureSettings(page);

  // Prompt -> five proposals as live previews.
  await page.goto("/new");
  await page
    .getByLabel("Describe the app you want to mock")
    .fill("A booking app for boutique hotels");
  await page.getByRole("button", { name: "Generate 5 proposals" }).click();

  await expect(
    page.getByRole("button", { name: "Use this layout" }),
  ).toHaveCount(5, { timeout: 60_000 });
  await expect(page.getByTestId("preview-frame")).toHaveCount(5);
  await expect(page.getByText("5 of 5 ready")).toBeVisible();

  // Pick the first (sidebar-shell) variant -> editor.
  await page.getByRole("button", { name: "Use this layout" }).first().click();
  await page.waitForURL(/\/project\/[^/]+$/);

  const preview = page.frameLocator('iframe[data-testid="preview-frame"]');
  await expect(preview.locator("h1")).toContainText("Overview");

  // Chat refinement rewrites the page and the preview re-renders.
  await page
    .getByLabel("Refinement request")
    .fill("Add a prominent search bar to the header");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(preview.locator("#mockable-refine")).toContainText(
    "Add a prominent search bar",
    { timeout: 45_000 },
  );

  // Manual code edit persists and re-renders.
  const manualHtml =
    '<!DOCTYPE html><html><body><h1>Manual edit marker</h1><a href="page://settings">Settings</a><a href="page://details">Details</a></body></html>';
  await page.getByRole("button", { name: "Code" }).click();
  await page.getByLabel("Page HTML").fill(manualHtml);
  await page.getByRole("button", { name: "Save code" }).click();
  await expect(page.getByRole("status")).toContainText(/saved/i);
  await expect(preview.locator("h1")).toHaveText("Manual edit marker");

  // Reload: the edit came from the server, not client state.
  await page.reload();
  await expect(preview.locator("h1")).toHaveText("Manual edit marker");
  await page.getByRole("button", { name: "Code" }).click();
  await expect(page.getByLabel("Page HTML")).toHaveValue(manualHtml);

  // Clicking a page:// link that does not exist offers to create the page.
  await page.getByRole("button", { name: "Hide code" }).click();
  await preview.getByRole("link", { name: "Settings", exact: true }).click();
  const createMissing = page.getByRole("button", {
    name: /Create page .*settings/i,
  });
  await expect(createMissing).toBeVisible();
  await createMissing.click();

  const pagesNav = page.getByRole("navigation", { name: "Pages" });
  await expect(
    pagesNav.getByRole("button", { name: /Settings/ }),
  ).toBeVisible({ timeout: 45_000 });
  await expect(preview.locator("h1")).toContainText(/settings/i);

  // Previously unresolved link now resolves instead of offering creation.
  await pagesNav.getByRole("button").first().click();
  await preview.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(preview.locator("h1")).toContainText(/settings/i);
  await expect(createMissing).toBeHidden();

  // Explicit add-page control.
  await page.getByRole("button", { name: "Add page" }).click();
  await page.getByLabel("New page name").fill("details");
  await page.getByLabel("New page description").fill("Order details");
  await page.getByRole("button", { name: "Create page" }).click();
  await expect(
    pagesNav.getByRole("button", { name: /Details/ }),
  ).toBeVisible({ timeout: 45_000 });

  // Share -> public player in a logged-out browser context.
  await pagesNav.getByRole("button").first().click();
  await page.getByRole("button", { name: "Share" }).click();
  const shareUrl = await page.getByLabel("Share link").inputValue();
  expect(shareUrl).toMatch(/\/p\/[A-Za-z0-9_-]+$/);

  const browser = page.context().browser();
  if (!browser) throw new Error("browser unavailable");
  const viewerContext = await browser.newContext();
  const viewer = await viewerContext.newPage();
  await viewer.goto(shareUrl);

  const player = viewer.frameLocator('iframe[data-testid="preview-frame"]');
  await expect(viewer.locator("header")).toContainText(
    "A booking app for boutique hotels",
  );
  await expect(player.locator("h1")).toHaveText("Manual edit marker");

  // Walk the flow via an in-flow link inside the prototype.
  await player.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(player.locator("h1")).toContainText(/settings/i);

  // Edits made after sharing are reflected when the link is reloaded.
  await page.getByRole("button", { name: "Code" }).click();
  const secondEdit =
    '<!DOCTYPE html><html><body><h1>Second manual marker</h1><a href="page://settings">Settings</a></body></html>';
  await page.getByLabel("Page HTML").fill(secondEdit);
  await page.getByRole("button", { name: "Save code" }).click();
  await expect(page.getByRole("status")).toContainText(/saved/i);

  await viewer.reload();
  await expect(player.locator("h1")).toHaveText("Second manual marker");

  // Revoke -> the previous URL no longer serves the flow.
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByLabel("Share link")).toBeHidden();

  await viewer.reload();
  await expect(
    viewer.getByText("This prototype is no longer available."),
  ).toBeVisible();

  await viewerContext.close();
});

test("without a saved LLM key, LLM features prompt for settings while the rest works", async ({
  browser,
}) => {
  // A fresh context has no localStorage, so no key is configured.
  const context = await browser.newContext();
  const page = await context.newPage();

  // Non-LLM workspace and settings still render.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "mockable" })).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByLabel("Provider")).toBeVisible();

  // LLM-backed generation is blocked with a settings prompt.
  await page.goto("/new");
  await page
    .getByLabel("Describe the app you want to mock")
    .fill("A travel planner");
  await page.getByRole("button", { name: "Generate 5 proposals" }).click();

  await expect(page.getByTestId("llm-settings-notice")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Settings" }),
  ).toHaveAttribute("href", "/settings");

  await context.close();
});
