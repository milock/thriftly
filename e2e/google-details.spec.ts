import { expect, test } from "@playwright/test";

test("Google review disclosure keeps directions usable when no rating is available", async ({ page, isMobile }) => {
  await page.route("**/api/place-match?**", route => route.fulfill({ json: { placeId: null } }));
  await page.goto("/goodwill/san-diego-ca");
  const row = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Google reviews", exact: true }) }).first();
  const button = row.getByRole("button", { name: "Google reviews", exact: true });
  const googleLink = row.getByRole("link", { name: "Google reviews", exact: true });
  const unavailable = row.getByText("Rating unavailable", { exact: true });
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(row.getByRole("link", { name: "Directions", exact: true })).toBeVisible();

  if (isMobile) {
    await button.tap();
  } else {
    await button.hover();
  }
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(unavailable).toBeVisible();
  await expect(googleLink).toHaveAttribute("href", /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Goodwill/);

  if (isMobile) {
    await button.tap();
  } else {
    await page.keyboard.press("Escape");
  }
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(googleLink).toBeHidden();
  await expect(unavailable).toBeVisible();
});
