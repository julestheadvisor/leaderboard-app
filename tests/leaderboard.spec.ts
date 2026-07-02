import { expect, test } from "@playwright/test";

test("shows the leaderboard without judge controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Live Leaderboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rankings" })).toBeVisible();
  await expect(page.getByText("Live sync on")).toBeVisible({ timeout: 15_000 });

  await expect(page.getByRole("heading", { name: "Session" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Group" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add Score" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit Group" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove Group" })).toHaveCount(0);
});
