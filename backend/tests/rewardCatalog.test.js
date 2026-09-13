import test from "node:test";
import assert from "node:assert/strict";
import {
  BARTENDER_REWARD_MILESTONES,
  buildRewardProgress,
} from "../utils/libs/bartenderRewards.js";

test("every bartender reward milestone contains two or three tangible items", () => {
  for (const reward of BARTENDER_REWARD_MILESTONES) {
    assert.ok(
      reward.items.length >= 2 && reward.items.length <= 3,
      `${reward.milestone}-event reward must contain two or three items`
    );
  }
});

test("the first-event kit includes a printed welcome letter", () => {
  const starter = BARTENDER_REWARD_MILESTONES.find((reward) => reward.milestone === 1);
  assert.ok(starter.items.some((item) => /welcome letter/i.test(item)));
  assert.match(starter.description, /congratulations/i);
  assert.match(starter.description, /thank you/i);
});

test("purchase links are valid and only included in admin reward progress", () => {
  for (const reward of BARTENDER_REWARD_MILESTONES) {
    assert.ok(reward.purchaseLinks.length >= 2);
    reward.purchaseLinks.forEach(({ label, url }) => {
      assert.ok(label);
      assert.match(url, /^https:\/\//);
    });
  }

  assert.equal(buildRewardProgress(0)[0].purchaseLinks, undefined);
  assert.ok(
    buildRewardProgress(0, [], { includePurchaseLinks: true })[0].purchaseLinks.length
  );
});

test("bartender reward milestones remain unique and increase in order", () => {
  const milestones = BARTENDER_REWARD_MILESTONES.map((reward) => reward.milestone);
  assert.equal(new Set(milestones).size, milestones.length);
  assert.deepEqual(milestones, [...milestones].sort((a, b) => a - b));
});
