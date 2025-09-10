#!/usr/bin/env node

const schedulerService = require("../src/services/schedulerService");
const teamService = require("../src/services/teamService");

async function debugScheduler() {
  console.log("🔍 Debugging Scheduler Service");
  console.log("=".repeat(50));
  
  try {
    // Get all active teams
    const teams = await teamService.getActiveTeamsForScheduling();
    console.log(`\n📊 Found ${teams.length} active teams:\n`);
    
    teams.forEach((team, index) => {
      console.log(`${index + 1}. ${team.name}`);
      console.log(`   - Standup Time: ${team.standupTime}`);
      console.log(`   - Posting Time: ${team.postingTime}`);
      console.log(`   - Timezone: ${team.timezone}`);
      console.log(`   - Channel: ${team.slackChannelId}`);
      console.log(`   - Active: ${team.isActive}`);
      console.log("");
    });

    // Get scheduled jobs info
    const jobs = schedulerService.getScheduledJobs();
    console.log(`📅 Currently scheduled jobs: ${jobs.length}\n`);
    
    jobs.forEach((job, index) => {
      console.log(`${index + 1}. Job ID: ${job.id}`);
      console.log(`   - Running: ${job.running}`);
      console.log(`   - Scheduled: ${job.scheduled}`);
      console.log("");
    });

    // Test refresh functionality
    if (teams.length > 0) {
      const testTeam = teams[0];
      console.log(`🔄 Testing refresh for team: ${testTeam.name}`);
      await schedulerService.refreshTeamSchedule(testTeam.id);
      console.log(`✅ Refresh completed for ${testTeam.name}`);
    }

    console.log("\n✨ Scheduler debug completed successfully!");
    
  } catch (error) {
    console.error("❌ Error debugging scheduler:", error);
  }
  
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  debugScheduler();
}

module.exports = { debugScheduler };