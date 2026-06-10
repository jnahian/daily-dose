const {
  convertTextToRichText,
  extractRichTextValue,
  escapeSlackText,
  unescapeSlackText,
} = require("../../src/utils/messageHelper");

/**
 * Assert the rich_text value is valid per Slack's schema:
 * every entry inside a rich_text_list's `elements` must be a rich_text_section
 * (Slack does NOT allow a rich_text_list nested directly inside another list's
 * elements — nesting is expressed with sibling lists + an `indent` integer).
 */
function assertValidRichText(node, path = "elements") {
  if (Array.isArray(node)) {
    node.forEach((n, i) => assertValidRichText(n, `${path}/${i}`));
    return;
  }
  if (node && typeof node === "object") {
    if (node.type === "rich_text_list") {
      node.elements.forEach((child, i) => {
        expect({
          path: `${path}/elements/${i}`,
          type: child.type,
        }).toEqual({
          path: `${path}/elements/${i}`,
          type: "rich_text_section",
        });
      });
    }
    Object.keys(node).forEach((k) =>
      assertValidRichText(node[k], `${path}/${k}`)
    );
  }
}

describe("convertTextToRichText", () => {
  it("produces a flat single list for non-indented bullets", () => {
    const rt = convertTextToRichText("• One\n• Two");
    expect(rt.elements).toHaveLength(1);
    expect(rt.elements[0].type).toBe("rich_text_list");
    expect(rt.elements[0].elements).toHaveLength(2);
    assertValidRichText(rt.elements);
  });

  it("does not nest a rich_text_list inside another list's elements (Slack-invalid)", () => {
    // Reproduces the production crash: indented bullets prefilled into a modal
    const rt = convertTextToRichText("• Parent\n  • Child\n  • Another child");
    assertValidRichText(rt.elements);
  });

  it("expresses nesting with sibling lists and an indent level", () => {
    const rt = convertTextToRichText("• Parent\n  • Child");
    const lists = rt.elements.filter((e) => e.type === "rich_text_list");
    expect(lists.length).toBeGreaterThanOrEqual(2);
    const child = lists.find((l) => l.indent > 0);
    expect(child).toBeDefined();
    expect(Number.isInteger(child.indent)).toBe(true);
  });

  it("round-trips an indented list through extract without crashing or corrupting", () => {
    const stored = "• Parent\n  • Child\n  • Another child";
    const rt = convertTextToRichText(stored);
    assertValidRichText(rt.elements);
    const reExtracted = extractRichTextValue({ rich_text_value: rt });
    // Re-converting the extracted string must also stay Slack-valid (stable).
    assertValidRichText(convertTextToRichText(reExtracted).elements);
  });
});

describe("mrkdwn control character escaping", () => {
  function richTextWith(elements) {
    return {
      rich_text_value: {
        type: "rich_text",
        elements: [{ type: "rich_text_section", elements }],
      },
    };
  }

  it("escapes &, < and > in raw text typed by the user", () => {
    const extracted = extractRichTextValue(
      richTextWith([{ type: "text", text: "a < b && b > c, <script>" }])
    );
    expect(extracted).toBe("a &lt; b &amp;&amp; b &gt; c, &lt;script&gt;");
  });

  it("keeps structured link and mention elements intact", () => {
    const extracted = extractRichTextValue(
      richTextWith([
        { type: "text", text: "see " },
        { type: "link", url: "https://example.com", text: "docs" },
        { type: "text", text: " and " },
        { type: "user", user_id: "U123" },
      ])
    );
    expect(extracted).toBe("see <https://example.com|docs> and <@U123>");
  });

  it("does not double-escape across an edit/resubmit cycle", () => {
    const extracted = extractRichTextValue(
      richTextWith([{ type: "text", text: "Tom & Jerry <3" }])
    );
    // Modal prefill rebuilds rich text from the stored string…
    const prefilled = convertTextToRichText(extracted);
    // …and resubmission extracts it again. The stored value must be stable.
    const reExtracted = extractRichTextValue({ rich_text_value: prefilled });
    expect(reExtracted).toBe(extracted);
  });

  it("keeps user-typed literal mention/link syntax literal across edit cycles", () => {
    // User TYPES the text "<@U123>" (not a real mention element). It must
    // stay literal text forever — never get promoted to an actual mention.
    const extracted = extractRichTextValue(
      richTextWith([{ type: "text", text: "ping <@U123> manually" }])
    );
    expect(extracted).toBe("ping &lt;@U123&gt; manually");

    const prefilled = convertTextToRichText(extracted);
    const textElements = JSON.stringify(prefilled);
    // No structured user element may appear from the escaped literal…
    expect(textElements).not.toContain('"type":"user"');
    // …and the re-extracted stored value is unchanged.
    const reExtracted = extractRichTextValue({ rich_text_value: prefilled });
    expect(reExtracted).toBe(extracted);
  });

  it("unescapeSlackText inverts escapeSlackText", () => {
    const raw = "a < b && b > c &amp; pre-escaped";
    expect(unescapeSlackText(escapeSlackText(raw))).toBe(raw);
  });
});
