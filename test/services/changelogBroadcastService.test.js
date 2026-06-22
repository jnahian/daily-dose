// Mutable mock for the changelog JSON the service reads.
const mockChangelog = { versions: [] };
jest.mock("../../web/src/data/changelog.json", () => mockChangelog);

jest.mock("../../src/config/prisma", () => ({
  organization: { findMany: jest.fn(), update: jest.fn() },
}));
jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const prisma = require("../../src/config/prisma");
const service = require("../../src/services/changelogBroadcastService");

function makeClient() {
  return { chat: { postMessage: jest.fn().mockResolvedValue({ ok: true }) } };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Make the 1.2s inter-post sleep instant.
  jest.spyOn(global, "setTimeout").mockImplementation((fn) => {
    fn();
    return 0;
  });
  mockChangelog.versions = [
    {
      version: "1.16.0",
      date: "2026-06-22",
      isLatest: true,
      changes: [{ type: "added", title: "T", items: ["i"] }],
    },
    { version: "1.15.0", date: "2026-06-17", isLatest: false, changes: [] },
  ];
});

afterEach(() => jest.restoreAllMocks());

describe("getLatestEntry / getLatestVersion", () => {
  it("returns the isLatest entry and its version", () => {
    expect(service.getLatestEntry().version).toBe("1.16.0");
    expect(service.getLatestVersion()).toBe("1.16.0");
  });
});

describe("broadcastOnDeploy", () => {
  it("seeds a null-marker org silently (no post, marker set)", async () => {
    const client = makeClient();
    prisma.organization.findMany.mockResolvedValue([
      {
        id: "o1",
        name: "Org1",
        botChannelId: "C1",
        lastBroadcastVersion: null,
      },
    ]);
    await service.broadcastOnDeploy(client, { mode: "live" });
    expect(client.chat.postMessage).not.toHaveBeenCalled();
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: { lastBroadcastVersion: "1.16.0" },
    });
  });

  it("posts to an org on an older version, then updates its marker", async () => {
    const client = makeClient();
    prisma.organization.findMany.mockResolvedValue([
      {
        id: "o2",
        name: "Org2",
        botChannelId: "C2",
        lastBroadcastVersion: "1.15.0",
      },
    ]);
    await service.broadcastOnDeploy(client, { mode: "live" });
    expect(client.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(client.chat.postMessage.mock.calls[0][0]).toMatchObject({
      channel: "C2",
      text: "What's new in Daily Dose v1.16.0",
      blocks: expect.any(Array),
    });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "o2" },
      data: { lastBroadcastVersion: "1.16.0" },
    });
  });

  it("skips an org already on the latest version", async () => {
    const client = makeClient();
    prisma.organization.findMany.mockResolvedValue([
      {
        id: "o3",
        name: "Org3",
        botChannelId: "C3",
        lastBroadcastVersion: "1.16.0",
      },
    ]);
    await service.broadcastOnDeploy(client, { mode: "live" });
    expect(client.chat.postMessage).not.toHaveBeenCalled();
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("does NOT update the marker when posting fails (retry next boot)", async () => {
    const client = makeClient();
    client.chat.postMessage.mockRejectedValue({
      data: { error: "channel_not_found" },
    });
    prisma.organization.findMany.mockResolvedValue([
      {
        id: "o4",
        name: "Org4",
        botChannelId: "C4",
        lastBroadcastVersion: "1.15.0",
      },
    ]);
    await service.broadcastOnDeploy(client, { mode: "live" });
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("mode=dry posts nothing and updates nothing", async () => {
    const client = makeClient();
    prisma.organization.findMany.mockResolvedValue([
      {
        id: "o5",
        name: "Org5",
        botChannelId: "C5",
        lastBroadcastVersion: "1.15.0",
      },
      {
        id: "o6",
        name: "Org6",
        botChannelId: "C6",
        lastBroadcastVersion: null,
      },
    ]);
    await service.broadcastOnDeploy(client, { mode: "dry" });
    expect(client.chat.postMessage).not.toHaveBeenCalled();
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("mode=off is a no-op (never queries orgs)", async () => {
    const client = makeClient();
    await service.broadcastOnDeploy(client, { mode: "off" });
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });

  it("no-ops when there is no changelog entry", async () => {
    const client = makeClient();
    mockChangelog.versions = [];
    await service.broadcastOnDeploy(client, { mode: "live" });
    expect(prisma.organization.findMany).not.toHaveBeenCalled();
  });
});
