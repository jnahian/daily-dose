const {
  createChangelogBroadcastBlocks,
} = require("../../src/utils/blockHelper");

const entry = {
  version: "1.16.0",
  date: "2026-06-22",
  changes: [
    { type: "added", title: "New thing", items: ["Did A", "Did B"] },
    { type: "fixed", title: "Fixed thing", items: ["Patched C"] },
    { type: "weird", title: "Misc", items: [] },
  ],
};

describe("createChangelogBroadcastBlocks", () => {
  const blocks = createChangelogBroadcastBlocks(
    entry,
    "https://dd.example/changelog"
  );

  it("starts with a header naming the version", () => {
    expect(blocks[0]).toEqual({
      type: "header",
      text: {
        type: "plain_text",
        text: "🚀 What's new in Daily Dose v1.16.0",
        emoji: true,
      },
    });
  });

  it("includes a section per change with the right emoji, bold title and bullets", () => {
    const texts = blocks
      .filter((b) => b.type === "section")
      .map((b) => b.text.text);
    expect(texts).toContain("✨ *New thing*\n• Did A\n• Did B");
    expect(texts).toContain("🔧 *Fixed thing*\n• Patched C");
    // unknown type falls back to 📌; no items => title only
    expect(texts).toContain("📌 *Misc*");
  });

  it("ends with a context block linking to the full changelog", () => {
    const last = blocks[blocks.length - 1];
    expect(last.type).toBe("context");
    expect(last.elements[0].text).toBe(
      "<https://dd.example/changelog|View full changelog>"
    );
  });
});
