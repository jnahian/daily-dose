-- CreateTable
CREATE TABLE "public"."oauth_clients" (
    "id" TEXT NOT NULL,
    "client_secret" TEXT,
    "client_name" TEXT,
    "redirect_uris" JSONB NOT NULL,
    "grant_types" JSONB,
    "response_types" JSONB,
    "scope" TEXT,
    "token_endpoint_auth_method" TEXT,
    "client_id_issued_at" INTEGER,
    "client_secret_expires_at" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."oauth_auth_codes" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT,
    "slack_state" TEXT NOT NULL,
    "code_hash" TEXT,
    "redirect_uri" TEXT NOT NULL,
    "client_state" TEXT,
    "code_challenge" TEXT NOT NULL,
    "code_challenge_method" TEXT NOT NULL DEFAULT 'S256',
    "scope" TEXT,
    "resource" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."oauth_tokens" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token_hash" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "scope" TEXT,
    "resource" TEXT,
    "access_token_expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_token_expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_auth_codes_slack_state_key" ON "public"."oauth_auth_codes"("slack_state");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_auth_codes_code_hash_key" ON "public"."oauth_auth_codes"("code_hash");

-- CreateIndex
CREATE INDEX "oauth_auth_codes_client_id_idx" ON "public"."oauth_auth_codes"("client_id");

-- CreateIndex
CREATE INDEX "oauth_auth_codes_user_id_idx" ON "public"."oauth_auth_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_tokens_access_token_hash_key" ON "public"."oauth_tokens"("access_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_tokens_refresh_token_hash_key" ON "public"."oauth_tokens"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "oauth_tokens_client_id_idx" ON "public"."oauth_tokens"("client_id");

-- CreateIndex
CREATE INDEX "oauth_tokens_user_id_idx" ON "public"."oauth_tokens"("user_id");

-- CreateIndex
CREATE INDEX "oauth_tokens_access_token_hash_idx" ON "public"."oauth_tokens"("access_token_hash");

-- CreateIndex
CREATE INDEX "oauth_tokens_refresh_token_hash_idx" ON "public"."oauth_tokens"("refresh_token_hash");

-- AddForeignKey
ALTER TABLE "public"."oauth_auth_codes" ADD CONSTRAINT "oauth_auth_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."oauth_auth_codes" ADD CONSTRAINT "oauth_auth_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."oauth_tokens" ADD CONSTRAINT "oauth_tokens_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
