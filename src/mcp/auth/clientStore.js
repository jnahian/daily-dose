const prisma = require("../../config/prisma");

function rowToClient(row) {
  return {
    client_id: row.id,
    client_id_issued_at: row.client_id_issued_at ?? undefined,
    client_secret: row.client_secret ?? undefined,
    client_secret_expires_at: row.client_secret_expires_at ?? undefined,
    redirect_uris: row.redirect_uris,
    token_endpoint_auth_method: row.token_endpoint_auth_method ?? undefined,
    grant_types: row.grant_types ?? undefined,
    response_types: row.response_types ?? undefined,
    scope: row.scope ?? undefined,
    client_name: row.client_name ?? undefined,
  };
}

// Implements the SDK OAuthRegisteredClientsStore interface.
const clientStore = {
  async getClient(clientId) {
    const row = await prisma.oauth_clients.findUnique({
      where: { id: clientId },
    });
    return row ? rowToClient(row) : undefined;
  },

  // The SDK register handler has already generated client_id / client_secret;
  // we persist what we're given and return it unchanged.
  async registerClient(client) {
    await prisma.oauth_clients.create({
      data: {
        id: client.client_id,
        client_secret: client.client_secret ?? null,
        client_name: client.client_name ?? null,
        redirect_uris: client.redirect_uris,
        grant_types: client.grant_types ?? null,
        response_types: client.response_types ?? null,
        scope: client.scope ?? null,
        token_endpoint_auth_method: client.token_endpoint_auth_method ?? null,
        client_id_issued_at: client.client_id_issued_at ?? null,
        client_secret_expires_at: client.client_secret_expires_at ?? null,
      },
    });
    return client;
  },
};

module.exports = { clientStore };
