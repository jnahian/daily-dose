-- CreateTable
CREATE TABLE "public"."mcp_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "name" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_tokens_token_hash_key" ON "public"."mcp_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "mcp_tokens_user_id_idx" ON "public"."mcp_tokens"("user_id");

-- CreateIndex
CREATE INDEX "mcp_tokens_token_hash_idx" ON "public"."mcp_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "public"."mcp_tokens" ADD CONSTRAINT "mcp_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
