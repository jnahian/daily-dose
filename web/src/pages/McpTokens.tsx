import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Copy, Check, Key, Trash2 } from "lucide-react";

interface McpUser {
  id: string;
  slackUserId: string;
  name: string;
}

interface McpToken {
  id: string;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  not_registered: "Your Slack account isn't registered with Daily Dose yet.",
  oauth_denied: "Slack sign-in was cancelled.",
  oauth_failed: "Sign-in failed. Please try again.",
  invalid_state: "Sign-in session expired. Please try again.",
};

export default function McpTokens() {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<McpUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [tokensError, setTokensError] = useState<string | null>(null);
  const [tokenName, setTokenName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const urlError = searchParams.get("error");

  useEffect(() => {
    fetch("/api/mcp/me", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("unauthenticated");
        return r.json();
      })
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  const loadTokens = () => {
    setTokensLoading(true);
    setTokensError(null);
    fetch("/api/mcp/tokens", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then((data) => setTokens(data))
      .catch((err) =>
        setTokensError(err instanceof Error ? err.message : "Failed to load tokens")
      )
      .finally(() => setTokensLoading(false));
  };

  useEffect(() => {
    if (user) loadTokens();
  }, [user]);

  const handleGenerate = () => {
    setGenerating(true);
    setNewToken(null);
    fetch("/api/mcp/tokens", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tokenName.trim() || undefined }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setNewToken(data.token);
        setTokenName("");
        loadTokens();
      })
      .catch((err) =>
        setTokensError(err instanceof Error ? err.message : "Failed to generate token")
      )
      .finally(() => setGenerating(false));
  };

  const handleRevoke = (id: string) => {
    setRevoking(id);
    fetch(`/api/mcp/tokens/${id}`, {
      method: "DELETE",
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        loadTokens();
      })
      .catch((err) =>
        setTokensError(err instanceof Error ? err.message : "Failed to revoke token")
      )
      .finally(() => setRevoking(null));
  };

  const handleCopy = () => {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fmt = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString() : "—";

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary pt-20">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <p className="text-white/40">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary pt-20">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-2">
          <Key className="w-7 h-7 text-brand-cyan" />
          <h1 className="text-3xl font-bold text-white">MCP Tokens</h1>
        </div>
        <p className="text-white/60 mb-8">
          Manage personal access tokens for the Daily Dose MCP server.
        </p>

        {/* URL error banner */}
        {urlError && ERROR_MESSAGES[urlError] && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {ERROR_MESSAGES[urlError]}
          </div>
        )}

        {!user ? (
          /* ── Not authenticated ── */
          <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
            <p className="text-white/60 mb-6">
              Sign in with your Slack account to manage your MCP tokens.
            </p>
            <a
              href="/api/mcp/auth/slack"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium"
            >
              Sign in with Slack
            </a>
          </div>
        ) : (
          /* ── Authenticated ── */
          <>
            <div className="mb-6 flex items-center justify-between">
              <span className="text-white/60 text-sm">
                Signed in as <span className="text-white">{user.name}</span>
              </span>
            </div>

            {/* Generate token */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                Generate New Token
              </h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Token name (optional)"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 text-sm"
                />
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-sm whitespace-nowrap"
                >
                  {generating ? "Generating…" : "Generate Token"}
                </button>
              </div>

              {/* Newly generated token */}
              {newToken && (
                <div className="mt-5 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-amber-400 text-sm font-medium mb-2">
                    Copy this token now — it won't be shown again.
                  </p>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 px-3 py-2 rounded bg-black/30 text-green-300 text-sm font-mono break-all select-all">
                      {newToken}
                    </code>
                    <button
                      onClick={handleCopy}
                      className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Token list */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">
                Your Tokens
              </h2>

              {tokensError && (
                <p className="text-red-400 text-sm mb-4">{tokensError}</p>
              )}

              {tokensLoading ? (
                <p className="text-white/40 text-sm">Loading tokens…</p>
              ) : tokens.length === 0 ? (
                <p className="text-white/40 text-sm">No tokens yet.</p>
              ) : (
                <ul className="space-y-3">
                  {tokens.map((token) => {
                    const isRevoked = Boolean(token.revoked_at);
                    return (
                      <li
                        key={token.id}
                        className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white font-medium text-sm truncate">
                              {token.name || "Unnamed token"}
                            </span>
                            {isRevoked && (
                              <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                                Revoked
                              </span>
                            )}
                          </div>
                          <div className="text-white/40 text-xs space-y-0.5">
                            <div>Created: {fmt(token.created_at)}</div>
                            <div>Last used: {fmt(token.last_used_at)}</div>
                            <div>Expires: {fmt(token.expires_at)}</div>
                          </div>
                        </div>

                        {!isRevoked && (
                          <button
                            onClick={() => handleRevoke(token.id)}
                            disabled={revoking === token.id}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {revoking === token.id ? "Revoking…" : "Revoke"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
