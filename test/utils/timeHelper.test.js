const { parseTimeString, TimeFormatError } = require("../../src/utils/timeHelper");

describe("parseTimeString", () => {
  describe("valid input", () => {
    it("parses HH:MM", () => {
      expect(parseTimeString("09:30")).toEqual({
        hour: 9,
        minute: 30,
        normalized: "09:30",
      });
    });

    it("parses single-digit hour and pads it", () => {
      expect(parseTimeString("9:30")).toEqual({
        hour: 9,
        minute: 30,
        normalized: "09:30",
      });
    });

    it("accepts boundary values 00:00 and 23:59", () => {
      expect(parseTimeString("00:00").normalized).toBe("00:00");
      expect(parseTimeString("23:59").normalized).toBe("23:59");
    });
  });

  describe("invalid input", () => {
    it.each([
      ["99:99", "hour"],
      ["24:00", "hour"],
      ["12:60", "minute"],
      ["9:5", "format"],
      [":30", "format"],
      ["12:", "format"],
      ["abc", "format"],
      ["", "format"],
      ["12:30:00", "format"],
    ])("rejects %s", (input) => {
      expect(() => parseTimeString(input)).toThrow(TimeFormatError);
    });

    it.each([null, undefined, 930, {}, []])("rejects non-string %p", (input) => {
      expect(() => parseTimeString(input)).toThrow(TimeFormatError);
    });

    it("error is flagged userFacing for sanitizer interop", () => {
      try {
        parseTimeString("99:99");
        throw new Error("should not reach here");
      } catch (err) {
        expect(err).toBeInstanceOf(TimeFormatError);
        expect(err.userFacing).toBe(true);
      }
    });
  });
});
