# MCP OAuth 2.1 Authorization — Design (Phase 4)

**Date:** 2026-06-17
**Status:** Approved for planning

## Goal

Let MCP clients authenticate to the Daily Dose MCP server through a standard,
browser-based **OAuth 2.1 flow that delegates login to Slack** — so a user
clicks "Connect," logs in with Slack once, and the client obtains and refreshes
its token automatically. No manual token copy-paste.

The existing manual bearer token (`ddm_…`, the `mcp_tokens` table) stays as a
fallback for headless/script clients and any client that doesn't support OAuth.

## Acceptance bar

Full **MCP Authorization specification** compliance (OAuth 2.1 + PKCE +
Dynamic Client Registration + metadata discovery), so that **Claude (Desktop and
claude.ai), Cursor, and VS Code (Copilot MCP)** — and any spec-compliant client —
complete the flow with zero manual token entry.

## Key decisions (from brainstorming)

| Decision       | Choice                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Spec target    | Full MCP Authorization spec — DCR + RFC 9728/8414 metadata + PKCE                                                               |
| Token model    | Short-lived access token (~1h) + rotating refresh token; re-login only when refresh expires (~90-day idle) or is revoked        |
| Token format   | Opaque, DB-backed (hashed at rest) — instant revocation, no JWT key management, consistent with `mcp_tokens`                    |
| Revocation UX  | Per-client list + revoke on the `/mcp-tokens` page (a "connected client" = the live grant rows for that `client_id`)            |
| Consent (v1)   | The user-initiated Slack browser login is the consent gate; no separate per-app approval screen (noted as a future enhancement) |
| Identity       | Slack (`identity.basic` / `identity.email`) → `users` row, exactly as today; per-tool `canManageTeam` checks unchanged          |
| Build approach | Custom `OAuthServerProvider` on the MCP SDK's `mcpAuthRouter`; Slack used only for the user-auth step                           |

## Non-goals (v1)

- **Not** removing the `ddm_` manual-token path — it remains the documented fallback.
- **No** third-party IdP (Auth0/WorkOS/Cloudflare Access).
- **No** separate per-app consent screen (Slack login is the gate).
- No new MCP tools or standup behavior — this is an alternate auth path to the
  same tools shipped in Phases 1–3.

## Why this approach

The installed `@modelcontextprotocol/sdk` (v1.29.0) ships server-side OAuth
helpers that encode the MCP-specific conformance details we'd otherwise re-derive:

- `mcpAuthRouter` / `mcpAuthMetadataRouter` — mounts spec-conformant
  `/authorize`, `/token`, `/register` (DCR), `/revoke`, and the
  authorization-server + protected-resource metadata endpoints.
- `OAuthServerProvider` interface (`server/auth/provider.js`) + an
  `OAuthRegisteredClientsStore` interface for DCR.
- `requireBearerAuth` / `bearerAuth` middleware that verifies tokens and emits a
  correct `WWW-Authenticate` challenge.

The SDK's `ProxyOAuthServerProvider` proxies to an **upstream OAuth 2.1** server.
Slack is OAuth 2.0 (no PKCE, no DCR), so a pure proxy doesn't fit. We instead
implement a **custom `OAuthServerProvider`** where _we_ are the authorization
server, using Slack only to authenticate the user inside `/authorize`. This
reuses the most SDK code while keeping interop risk with the target clients low.

Rejected alternatives: a hand-rolled AS on a generic OAuth library (re-derives
MCP conformance the SDK already encodes); an external/managed IdP (adds a paid
dependency, still has to federate Slack identity, fights the self-hosted setup).

## Architecture

`POST /mcp` becomes an OAuth-protected resource. New code lives under
`src/mcp/auth/`. Identity still resolves to a `users` row via Slack, so the tool
layer and all `canManageTeam` checks are untouched.

```
MCP client (Claude / Cursor / VS Code)
   │ 1. POST /mcp  →  401 + WWW-Authenticate: resource_metadata="…/.well-known/oauth-protected-resource"
   ▼
GET /.well-known/oauth-protected-resource     → names our Authorization Server
GET /.well-known/oauth-authorization-server   → authorize / token / register / revoke URLs   (mcpAuthRouter)
   │ 2. POST /register  (Dynamic Client Registration)  → client_id            [oauth_clients]
   │ 3. browser → /authorize?client_id&code_challenge&redirect_uri&state&resource
   ▼
/authorize  →  validate client+PKCE+redirect  →  store in-flight auth, redirect to Slack OAuth
   │  Slack login  →  Slack callback  →  resolve identity → users row
   │  →  mint single-use PKCE-bound code, redirect to client redirect_uri?code&state    [oauth_auth_codes]
   │ 4. POST /token (grant_type=authorization_code, code, code_verifier)
   │      → { access_token (~1h), refresh_token, token_type, expires_in }               [oauth_tokens]
   ▼
POST /mcp  Authorization: Bearer <access_token>
   │  combined bearer middleware → verifyAccessToken → req.mcpUser → tools (unchanged)
   │ 5. on expiry: POST /token (grant_type=refresh_token) → new access + rotated refresh
   │ 6. revoke: POST /revoke, or per-client revoke from /mcp-tokens
```

## Data model

Opaque, DB-backed tokens (hashed with SHA-256 like `mcp_tokens`). Three new
Prisma models, snake_case to match `mcp_tokens` / `sessions`. Exact columns are
finalized in the implementation plan; the responsibilities are:

### `oauth_clients` — Dynamic Client Registration records (global, not user-owned)

| field                              | notes                                             |
| ---------------------------------- | ------------------------------------------------- |
| id                                 | PK; serves as `client_id`                         |
| client_secret_hash                 | nullable; null for public/PKCE clients            |
| client_name                        | from DCR metadata (e.g. "Claude")                 |
| redirect_uris                      | JSON array; exact-match validated at `/authorize` |
| grant_types, response_types, scope | DCR metadata                                      |
| token_endpoint_auth_method         | e.g. `none` for public clients                    |
| created_at                         |                                                   |

### `oauth_auth_codes` — the in-flight authorization (pending → issued)

Holds the PKCE/redirect/resource context from `/authorize` and the Slack
hand-off state; after Slack login, gains `user_id` and the hashed single-use
code. Short TTL (~5 min), single-use (deleted/marked on exchange).

| field                                 | notes                                             |
| ------------------------------------- | ------------------------------------------------- |
| id                                    | PK                                                |
| client_id                             | FK → oauth_clients                                |
| user_id                               | FK → users; set after Slack login                 |
| slack_state                           | random; correlates the Slack round-trip           |
| code_hash                             | unique; set after Slack login; null while pending |
| redirect_uri, client_state            | the client's original redirect + state            |
| code_challenge, code_challenge_method | PKCE (S256)                                       |
| scope, resource                       | requested scope + audience (RFC 8707)             |
| expires_at, created_at                |                                                   |

### `oauth_tokens` — issued grants (the "connected clients")

| field                                             | notes                                 |
| ------------------------------------------------- | ------------------------------------- |
| id                                                | PK                                    |
| client_id                                         | FK → oauth_clients                    |
| user_id                                           | FK → users                            |
| access_token_hash                                 | unique; ~1h expiry                    |
| refresh_token_hash                                | unique; rotating; ~90-day idle expiry |
| scope, resource                                   |                                       |
| access_token_expires_at, refresh_token_expires_at |                                       |
| revoked_at, last_used_at, created_at              |                                       |

`User` gains `oauth_auth_codes` and `oauth_tokens` relations (cascade delete).
`oauth_clients` has no user FK — DCR clients are app registrations, not
user-owned; the user association is on the code/token rows.

A **connected client** in the UI is the set of non-revoked `oauth_tokens` rows
for a `(user_id, client_id)` whose refresh token hasn't expired; revoking a
client sets `revoked_at` on all of them.

## Components (new, under `src/mcp/auth/`)

- **`clientStore.js`** — implements the SDK `OAuthRegisteredClientsStore`
  (`getClient`, `registerClient`) over `oauth_clients`; validates redirect URIs.
- **`oauthTokenService.js`** — mint / verify / rotate / revoke access + refresh
  tokens; hashing, expiry, `last_used_at`. Parallels `mcpTokenService`.
- **`slackAuthBridge.js`** — the `/authorize` → Slack → callback hand-off:
  persists the in-flight authorization (`oauth_auth_codes`), redirects to Slack,
  and on callback resolves the Slack identity to a `users` row and mints the
  authorization code. Reuses the Slack identity-resolution logic currently inside
  `src/routes/mcpAuth.js` (extracted into a shared helper both flows call).
- **`oauthProvider.js`** — implements the SDK `OAuthServerProvider`:
  `authorize`, `challengeForAuthorizationCode`, `exchangeAuthorizationCode`,
  `exchangeRefreshToken`, `verifyAccessToken`, `revokeToken`. Pure orchestration
  delegating to the services above.
- **`index.js`** — builds the provider, mounts `mcpAuthRouter` + the
  protected-resource metadata endpoint, and exports the **combined bearer
  middleware**. Wired in `src/app.js`.

### Changes to existing files

- **`src/app.js`** — mount the OAuth auth router + protected-resource metadata;
  replace `validateMcpToken` on `/mcp` with the combined bearer middleware.
- **`src/mcp/server.js`** — `validateMcpToken` stays but is wrapped by the
  combined middleware (OAuth first, legacy `ddm_` fallback).
- **`src/routes/mcpAuth.js`** — extract the shared "exchange Slack code → user"
  helper; add `GET /api/mcp/connections` and `DELETE /api/mcp/connections/:id`
  for the per-client list/revoke UI (behind the existing `requireMcpSession`).
- **`web/src/pages/McpTokens.tsx`** — add a "Connected AI clients" section
  (name, last used, Revoke) above/alongside the existing manual-token list.
- **`prisma/schema.prisma`** — 3 new models + `User` relations; one committed
  migration.
- **Docs** — reposition OAuth as the recommended connection method in the
  `/docs` MCP section and on the token page; keep the manual token as "advanced."

## Fallback coexistence

`POST /mcp` runs a **combined bearer middleware**: it first attempts OAuth
`verifyAccessToken`; on miss it falls back to `mcpTokenService.validateToken`
(legacy `ddm_`). Both set `req.mcpUser` identically, so the tool layer is
agnostic to which path authenticated the request.

## Error handling

- OAuth errors use the SDK handlers' spec-compliant shapes (`invalid_client`,
  `invalid_grant`, `invalid_request`, `unauthorized_client`, …).
- `/mcp` without/with a bad token → `401` + `WWW-Authenticate` (SDK
  `requireBearerAuth`) pointing at the protected-resource metadata.
- PKCE mismatch, expired or replayed code, redirect_uri mismatch → `invalid_grant`.
- DCR rejects malformed/missing `redirect_uris`.
- Slack failure or denial during `/authorize` → redirect back to the client's
  `redirect_uri` with `error=access_denied`; unrecoverable cases → a friendly
  error on `/mcp-tokens`.

## Security

- **PKCE (S256) mandatory** for all clients.
- **Exact `redirect_uri` match** against the registered set.
- **Single-use, short-TTL authorization codes**; replay → `invalid_grant`.
- **Rotating refresh tokens** (old refresh invalidated on use).
- **All tokens hashed at rest**; raw values returned once over TLS.
- **Audience binding** via RFC 8707 resource indicators: the requested `resource`
  is captured on the authorization code, carried onto the grant, and surfaced on
  the verified `AuthInfo`. In v1 this binding holds **by construction** — `/mcp` is
  the only resource server that validates `mcat_` access tokens — rather than by an
  active audience check in the bearer middleware. (Enforcing `info.resource` against
  the RS identifier is a follow-up once a second resource server exists.)
- **Revoke kills all grants** for a `(user, client)`.
- The in-flight authorization state lives in the DB (`oauth_auth_codes`), not an
  in-memory map, so it survives across the Slack round-trip and is multi-instance
  safe (an improvement over the existing `oauthStates` Map in `mcpAuth.js`).

## Testing

- **Unit:** `oauthTokenService` (mint/verify/rotate/revoke, expiry, hashing);
  `clientStore` (register/get, redirect-URI validation); `oauthProvider`
  (code exchange happy path, expired code, replayed code, PKCE failure,
  redirect mismatch; refresh rotation; `verifyAccessToken` valid/expired/revoked).
- **Combined bearer middleware:** OAuth token, legacy `ddm_`, and invalid → 401.
- **Metadata endpoints:** protected-resource and authorization-server metadata
  return the expected JSON shapes/URLs.
- **Scripted integration:** the full dance — register → authorize (Slack mocked)
  → token → call `/mcp` → refresh → revoke → call again expects 401.
- **Manual E2E:** connect a real client (Claude / Cursor / VS Code) end-to-end —
  this is the acceptance bar.

## Open risks

- **Client interop drift.** Target clients implement the evolving MCP auth spec
  at different paces; the manual `ddm_` fallback covers any gap, and the SDK's
  conformant endpoints minimize the risk. Validate each target client in the
  manual E2E.
- **Slack hand-off inside `/authorize`.** The provider's `authorize` must round-
  trip through Slack and return a code to the client; the `oauth_auth_codes`
  pending row + `slack_state` carries the context. This is the most intricate
  piece and is called out for careful implementation + tests.
- **SDK auth API surface.** `mcpAuthRouter`/`OAuthServerProvider` are real but
  comparatively newer SDK surface; the plan will pin exact signatures against
  the installed v1.29.0 during implementation.

## Implementation scope

A single implementation plan covering: the 3 Prisma models + migration; the four
`src/mcp/auth/` units; the `app.js` wiring + combined middleware; the
`mcpAuth.js` connection list/revoke endpoints + shared Slack helper extraction;
the `McpTokens.tsx` connected-clients UI; docs repositioning; and the test suite
above. The `ddm_` path and all Phase 1–3 tools are unchanged.
