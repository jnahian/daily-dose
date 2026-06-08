const { parseCommandArguments } = require("../../src/utils/teamHelper");

describe("parseCommandArguments mention extraction", () => {
  it("returns null mentionedUserId when no mention present", () => {
    expect(parseCommandArguments("2025-01-15 Engineering")).toEqual({
      date: "2025-01-15",
      teamName: "Engineering",
      mentionedUserId: null,
    });
  });

  it("extracts a mention with a pipe label and keeps date + team", () => {
    const res = parseCommandArguments(
      "<@U123ABC|alice> 2025-01-15 Engineering"
    );
    expect(res).toEqual({
      date: "2025-01-15",
      teamName: "Engineering",
      mentionedUserId: "U123ABC",
    });
  });

  it("extracts a bare mention with no label", () => {
    const res = parseCommandArguments("<@U999>");
    expect(res).toEqual({
      date: null,
      teamName: null,
      mentionedUserId: "U999",
    });
  });

  it("uses the first mention when several are present", () => {
    const res = parseCommandArguments("<@U111|a> <@U222|b>");
    expect(res.mentionedUserId).toBe("U111");
  });

  it("returns all-null for empty input", () => {
    expect(parseCommandArguments("")).toEqual({
      date: null,
      teamName: null,
      mentionedUserId: null,
    });
  });
});
