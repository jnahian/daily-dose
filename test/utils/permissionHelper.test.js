jest.mock("../../src/config/prisma", () => ({
  team: { findFirst: jest.fn() },
  organizationMember: { findUnique: jest.fn() },
  teamMember: { findFirst: jest.fn() },
  user: { findUnique: jest.fn() },
}));

const prisma = require("../../src/config/prisma");
const {
  canManageTeam,
  isOrganizationAdmin,
} = require("../../src/utils/permissionHelper");

describe("canManageTeam org admin access", () => {
  beforeEach(() => jest.clearAllMocks());

  it("grants management to an active org admin", async () => {
    prisma.team.findFirst.mockResolvedValue({ organizationId: "o1" });
    // Both the owner check and the admin check call findUnique; ADMIN role
    // fails the owner check (role !== OWNER) and passes the admin check.
    prisma.organizationMember.findUnique
      .mockResolvedValueOnce({ role: "ADMIN", isActive: true }) // owner check → false
      .mockResolvedValueOnce({ role: "ADMIN", isActive: true }); // admin check → true
    prisma.teamMember.findFirst.mockResolvedValue(null);

    const res = await canManageTeam("u1", "t1");
    expect(res).toMatchObject({ canManage: true, role: "ORG_ADMIN" });
  });

  it("denies a plain org member who is not a team admin", async () => {
    prisma.team.findFirst.mockResolvedValue({ organizationId: "o1" });
    prisma.organizationMember.findUnique.mockResolvedValue({
      role: "MEMBER",
      isActive: true,
    });
    prisma.teamMember.findFirst.mockResolvedValue(null);

    const res = await canManageTeam("u1", "t1");
    expect(res.canManage).toBe(false);
  });

  it("isOrganizationAdmin is false for an inactive admin", async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({
      role: "ADMIN",
      isActive: false,
    });
    expect(await isOrganizationAdmin("u1", "o1")).toBe(false);
  });

  it("isOrganizationAdmin is false when not a member", async () => {
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    expect(await isOrganizationAdmin("u1", "o1")).toBe(false);
  });
});
