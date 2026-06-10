const {
  createUserResponseBlocks,
  createLateResponseBlocks,
} = require("../../src/utils/blockHelper");

// Slack rejects the whole message with `invalid_blocks` when a section
// `fields[].text` exceeds 2000 chars or a section `text` exceeds 3000.
const SLACK_FIELD_MAX = 2000;
const SLACK_TEXT_MAX = 3000;

function assertWithinSlackLimits(blocks) {
  for (const block of blocks) {
    if (block.type === "context") {
      for (const element of block.elements) {
        expect(element.text.length).toBeLessThanOrEqual(SLACK_FIELD_MAX);
      }
      continue;
    }
    if (block.type !== "section") continue;
    if (Array.isArray(block.fields)) {
      for (const field of block.fields) {
        expect(field.text.length).toBeLessThanOrEqual(SLACK_FIELD_MAX);
      }
    }
    if (block.text) {
      expect(block.text.text.length).toBeLessThanOrEqual(SLACK_TEXT_MAX);
    }
  }
}

const longTasks = "https://example.com/very/long/url\n".repeat(120); // ~4000 chars

describe("blockHelper standup blocks stay within Slack limits", () => {
  it("createUserResponseBlocks truncates oversized task content", () => {
    const blocks = createUserResponseBlocks({
      userMention: "<@U123>",
      yesterdayTasks: longTasks,
      todayTasks: "short task",
    });
    assertWithinSlackLimits(blocks);
  });

  it("createLateResponseBlocks truncates oversized task content", () => {
    const blocks = createLateResponseBlocks({
      userMention: "<@U123>",
      yesterdayTasks: longTasks,
      todayTasks: "short task",
    });
    assertWithinSlackLimits(blocks);
  });

  it("truncates oversized blocker content in summary and late blocks", () => {
    const response = {
      userMention: "<@U123>",
      yesterdayTasks: "did stuff",
      todayTasks: "will do stuff",
      blockers: longTasks,
    };
    assertWithinSlackLimits(createUserResponseBlocks(response));
    assertWithinSlackLimits(createLateResponseBlocks(response));
  });

  it("does not wrap blocker text in italics (nested mrkdwn corrupts rendering)", () => {
    const blockers = "waiting on _staging_ access\n• infra ticket";
    const blocks = createUserResponseBlocks({
      userMention: "<@U123>",
      yesterdayTasks: "did stuff",
      todayTasks: "will do stuff",
      blockers,
    });
    const blockerBlock = blocks.find((b) =>
      b.text?.text?.includes("*Blocker:*")
    );
    expect(blockerBlock).toBeDefined();
    expect(blockerBlock.text.text).toBe(`⚠️ *Blocker:* ${blockers}`);
  });

  it("createLateResponseBlocks uses compact fields when content fits", () => {
    const blocks = createLateResponseBlocks({
      userMention: "<@U123>",
      yesterdayTasks: "did stuff",
      todayTasks: "will do stuff",
    });
    const fieldsBlock = blocks.find(
      (b) => b.type === "section" && Array.isArray(b.fields)
    );
    expect(fieldsBlock).toBeDefined();
    expect(fieldsBlock.fields).toHaveLength(2);
    assertWithinSlackLimits(blocks);
  });
});
