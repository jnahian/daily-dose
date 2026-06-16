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

/**
 * Build the POST /mcp handler. `slackApp` is the initialized Bolt app so tools
 * can reach slackApp.client to post to Slack.
 */
function createMcpHandler(slackApp) {
  return async function handleMcp(req, res) {
    // Stateless: a fresh server + transport per request, bound to the user.
    const server = new McpServer({
      name: "daily-dose-standup",
      version: "1.0.0",
    });
    registerTools(server, req.mcpUser, slackApp.client);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };
}

module.exports = { validateMcpToken, createMcpHandler };
