import { expect, test } from "@playwright/test";

test("syncs groups and scores across judge screens", async ({ browser }) => {
  const context = await browser.newContext();
  const judgeOne = await context.newPage();
  const judgeTwo = await context.newPage();
  const groupName = `Test Group ${Date.now()}`;
  const editedGroupName = `${groupName} Edited`;

  await judgeOne.goto("/");
  await judgeTwo.goto("/");

  await expect(judgeOne.getByRole("heading", { name: "Live Leaderboard" })).toBeVisible();
  await expect(judgeTwo.getByText("Live sync on")).toBeVisible({ timeout: 15_000 });

  await judgeOne.getByRole("button", { name: "Add Group" }).click();
  await judgeOne.getByLabel("Group name").fill(groupName);
  await judgeOne.getByRole("button", { name: "Submit Group" }).click();

  await expect(judgeTwo.getByRole("cell", { name: groupName })).toBeVisible({
    timeout: 15_000,
  });

  await judgeTwo.getByRole("button", { name: "Add Score" }).click();
  await judgeTwo.locator("#score-group").selectOption({ label: groupName });
  await judgeTwo.getByRole("textbox", { name: "Score" }).fill("42abc7");
  await expect(judgeTwo.getByRole("textbox", { name: "Score" })).toHaveValue("427");
  await judgeTwo.getByRole("button", { name: "Submit Score" }).click();

  const row = judgeOne.getByRole("row").filter({ hasText: groupName });
  await expect(row.getByRole("cell", { name: "427", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(row.getByText("+427", { exact: true })).toBeVisible();

  await judgeTwo.getByRole("button", { name: "Add Score" }).click();
  await judgeTwo.locator("#score-group").selectOption({ label: groupName });
  await judgeTwo.getByRole("textbox", { name: "Score" }).fill("12-3");
  await expect(judgeTwo.getByRole("textbox", { name: "Score" })).toHaveValue("123");
  await judgeTwo.getByRole("textbox", { name: "Score" }).fill("-27abc");
  await expect(judgeTwo.getByRole("textbox", { name: "Score" })).toHaveValue("-27");
  await judgeTwo.getByRole("button", { name: "Submit Score" }).click();

  await expect(row.getByRole("cell", { name: "400", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(row.getByText("-27", { exact: true })).toBeVisible();

  await judgeTwo.getByRole("button", { name: "Edit Group" }).click();
  await judgeTwo.locator("#edit-group").selectOption({ label: groupName });
  await judgeTwo.getByLabel("Group name").fill(editedGroupName);
  await judgeTwo.getByRole("button", { name: "Save Group" }).click();

  const editedRow = judgeOne.getByRole("row").filter({ hasText: editedGroupName });
  await expect(editedRow.getByRole("cell", { name: "400", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  await judgeTwo.getByRole("button", { name: "Remove Group" }).click();
  await judgeTwo.locator("#remove-group").selectOption({ label: editedGroupName });
  await judgeTwo
    .getByRole("dialog", { name: "Remove Group" })
    .getByRole("button", { name: "Remove Group" })
    .click();

  await expect(judgeOne.getByRole("cell", { name: editedGroupName })).toBeHidden({
    timeout: 15_000,
  });

  await context.close();
});
