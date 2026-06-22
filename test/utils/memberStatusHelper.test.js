const { deriveMemberStatus } = require("../../src/utils/memberStatusHelper");

const base = {
  role: "MEMBER",
  teamActive: true,
  orgActive: true,
  onLeave: false,
  workingToday: true,
  responded: false,
};

describe("deriveMemberStatus", () => {
  it("flags team-inactive members and suppresses standup", () => {
    expect(deriveMemberStatus({ ...base, teamActive: false })).toEqual({
      active: false,
      inactiveScope: "team",
      standup: null,
    });
  });

  it("flags org-inactive members (team active) as org scope", () => {
    expect(deriveMemberStatus({ ...base, orgActive: false })).toEqual({
      active: false,
      inactiveScope: "org",
      standup: null,
    });
  });

  it("prefers team scope when inactive in both", () => {
    expect(
      deriveMemberStatus({ ...base, teamActive: false, orgActive: false })
        .inactiveScope
    ).toBe("team");
  });

  it("shows on-leave even for admins", () => {
    expect(
      deriveMemberStatus({ ...base, role: "ADMIN", onLeave: true }).standup
    ).toBe("leave");
  });

  it("suppresses standup for active admins", () => {
    expect(deriveMemberStatus({ ...base, role: "ADMIN" }).standup).toBeNull();
  });

  it("suppresses standup on a non-work-day", () => {
    expect(
      deriveMemberStatus({ ...base, workingToday: false }).standup
    ).toBeNull();
  });

  it("reports submitted when responded on a work day", () => {
    expect(deriveMemberStatus({ ...base, responded: true }).standup).toBe(
      "submitted"
    );
  });

  it("reports pending when not responded on a work day", () => {
    expect(deriveMemberStatus(base).standup).toBe("pending");
  });
});
