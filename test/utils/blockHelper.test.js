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
