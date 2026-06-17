const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const tokenService = require("../services/mcpTokenService");
const { registerTools } = require("./tools");

// Express middleware: resolve Authorization: Bearer <token> -> req.mcpUser
async function validateMcpToken(req, res, next) {
  const header = req.headers.authorization || "";
  const rawToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!rawToken) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  try {
    const user = await tokenService.validateToken(rawToken);
    if (!user)
      return res.status(401).json({ error: "Invalid or expired token" });
    req.mcpUser = user;
    next();
  } catch (err) {
    console.error("validateMcpToken error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Server identity advertised to MCP clients on initialize. Clients that support
// the MCP icons spec render the icon next to the connected server; the rest
// ignore it. Icon URLs point at the static assets served from web/dist.
function mcpServerInfo() {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
  return {
    name: "daily-dose-standup",
    title: "Daily Dose",
    version: "1.0.0",
    websiteUrl: "https://dd.jnahian.me",
    icons: [
      {
        src: `${base}/favicon-32x32.png`,
        mimeType: "image/png",
        sizes: ["32x32"],
      },
      {
        src: `${base}/android-chrome-192x192.png`,
        mimeType: "image/png",
        sizes: ["192x192"],
      },
      {
        src: `${base}/android-chrome-512x512.png`,
        mimeType: "image/png",
        sizes: ["512x512"],
      },
    ],
  };
}

/**
 * Build the POST /mcp handler. `slackApp` is the initialized Bolt app so tools
 * can reach slackApp.client to post to Slack.
 */
function createMcpHandler(slackApp) {
  return async function handleMcp(req, res) {
    // Stateless: a fresh server + transport per request, bound to the user.
    const server = new McpServer(mcpServerInfo());
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      registerTools(server, req.mcpUser, slackApp.client);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      // Express (Bolt's receiver) does not catch rejected promises, so an
      // unhandled error here would hang the request instead of responding.
      // The transport may already have started streaming, so only send a
      // fallback 500 if nothing has been written yet.
      console.error("handleMcp error:", err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };
}

module.exports = { validateMcpToken, createMcpHandler, mcpServerInfo };
