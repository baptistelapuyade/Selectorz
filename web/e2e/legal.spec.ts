import { expect, test } from "@playwright/test";

// Impressum muss von jeder Seite mit einem Klick erreichbar sein (§ 5 DDG).
for (const path of ["/", "/login", "/imprint"]) {
  test(`Impressum von ${path} aus mit einem Klick`, async ({ page }) => {
    await page.goto(path);
    await page.getByRole("contentinfo").getByRole("link", { name: "Imprint" }).click();
    await expect(page).toHaveURL(/\/imprint$/);
    await expect(page.getByRole("heading", { name: "Imprint" })).toBeVisible();
    await expect(page.getByText("Weserstraße 140")).toBeVisible();
    await expect(page.getByRole("link", { name: "hello@selectorz.art" })).toHaveAttribute("href", "mailto:hello@selectorz.art");
  });
}
