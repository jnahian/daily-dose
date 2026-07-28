-- CreateTable
CREATE TABLE "public"."mcp_tool_calls" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_tool_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mcp_tool_calls_user_id_idx" ON "public"."mcp_tool_calls"("user_id");

-- CreateIndex
CREATE INDEX "mcp_tool_calls_created_at_idx" ON "public"."mcp_tool_calls"("created_at");

-- AddForeignKey
ALTER TABLE "public"."mcp_tool_calls" ADD CONSTRAINT "mcp_tool_calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
