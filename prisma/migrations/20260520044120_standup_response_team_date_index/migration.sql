-- CreateIndex
CREATE INDEX "standup_responses_team_id_standup_date_idx" ON "public"."standup_responses"("team_id", "standup_date");
