# Daily Dose Slack Bot - Complete Implementation Guide with Prisma

## Architecture Overview

- **Framework**: Slack Bolt JS
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **Scheduler**: node-cron
- **Multi-tenant**: Organization-based structure

## Phase 1: Project Setup and Prerequisites

### Step 1.1: Initialize Project ✅

```bash
mkdir daily-dose
cd daily-dose
npm init -y
```

### Step 1.2: Install Required Dependencies ✅

```bash
# Core dependencies
npm install @slack/bolt dayjs dotenv node-cron @prisma/client

# Development dependencies
npm install -D prisma nodemon eslint typescript @types/node
```

### Step 1.3: Environment Variables ✅

Create `.env` file:

```env
# Slack Credentials
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_USER_TOKEN=xoxp-your-user-token

# Database URLs
DATABASE_URL="postgresql://user:password@host:5432/database"
DIRECT_URL="postgresql://user:password@host:5432/database"

# App Settings
PORT=3000
HOST=localhost
DEFAULT_TIMEZONE=America/New_York
APP_URL=https://your-domain.com
NODE_ENV=development

# Logging
LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn
```

### Step 1.4: Initialize Prisma ✅

```bash
npx prisma init
```

### Step 1.4: Project Structure ✅

```
daily-dose/
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Migration files
├── src/
│   ├── app.js                  # Main application entry
│   ├── config/
│   │   └── prisma.js          # Prisma client instance
│   ├── commands/
│   │   ├── index.js           # Command registration with middleware
│   │   ├── team.js            # Team management commands
│   │   ├── leave.js           # Leave management commands
│   │   ├── standup.js         # Standup commands (manual & update)
│   │   └── holiday.js         # Holiday management commands
│   ├── workflows/
│   │   └── index.js           # Future workflow implementations
│   ├── services/
│   │   ├── teamService.js     # Team CRUD operations
│   │   ├── userService.js     # User management
│   │   ├── standupService.js  # Standup logic
│   │   └── schedulerService.js # Cron job management
│   ├── middleware/
│   │   ├── command.js         # Command formatting removal
│   │   └── logging.js         # Request/response logging
│   ├── utils/
│   │   ├── dateHelper.js      # Date/holiday checking
│   │   ├── logger.js          # Logging utilities
│   │   ├── commandHelper.js   # Command processing helpers
│   │   ├── messageHelper.js   # Message formatting helpers
│   │   ├── blockHelper.js     # Slack block UI helpers
│   │   └── userHelper.js      # User data helpers
│   └── scripts/
│       ├── seedOrg.js         # Manual organization setup
│       ├── updateSlackManifest.js # Slack manifest management
│       ├── triggerStandup.js  # Manual standup triggers
│       ├── sendManualStandup.js # Manual standup posting
│       ├── viewSlackTeamInfo.js # Slack team information
│       └── check-team-members.js # Team member validation
├── .env
└── package.json
```

## Phase 2: Database Setup with Prisma & Supabase

### Step 2.1: Create Supabase Project ✅

1. Go to https://supabase.com and create a new project
2. Get your database URLs from Settings > Database

### Step 2.2: Configure Environment Variables ✅

Create `.env` file:

```env
# Supabase Database URLs
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?schema=public"
DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?schema=public"

# Slack Credentials
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_APP_TOKEN=xapp-your-app-token

# App Settings
PORT=3000
DEFAULT_TIMEZONE=America/New_York
NODE_ENV=development
```

### Step 2.3: Prisma Schema (`prisma/schema.prisma`) ✅

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// Organization model
model Organization {
  id                String                @id @default(uuid())
  name              String                @unique
  slackWorkspaceId  String?               @unique @map("slack_workspace_id")
  slackWorkspaceName String?              @map("slack_workspace_name")
  defaultTimezone   String                @default("America/New_York") @map("default_timezone")
  settings          Json                  @default("{}")
  isActive          Boolean               @default(true) @map("is_active")
  createdAt         DateTime              @default(now()) @map("created_at")
  updatedAt         DateTime              @updatedAt @map("updated_at")

  teams             Team[]
  members           OrganizationMember[]

  @@map("organizations")
}

// Team model
model Team {
  id              String              @id @default(uuid())
  organizationId  String              @map("organization_id")
  name            String
  slackChannelId  String              @unique @map("slack_channel_id")
  standupTime     DateTime            @db.Time() @map("standup_time")
  postingTime     DateTime            @db.Time() @map("posting_time")
  timezone        String              @default("America/New_York")
  isActive        Boolean             @default(true) @map("is_active")
  createdAt       DateTime            @default(now()) @map("created_at")
  updatedAt       DateTime            @updatedAt @map("updated_at")

  organization    Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  members         TeamMember[]
  standupResponses StandupResponse[]
  standupPosts    StandupPost[]

  @@unique([organizationId, name])
  @@index([organizationId])
  @@map("teams")
}

// User model
model User {
  id              String                @id @default(uuid())
  slackUserId     String                @unique @map("slack_user_id")
  email           String?
  name            String?
  timezone        String                @default("America/New_York")
  workDays        Json?                 @map("work_days") // [1,2,3,4,5] for Mon-Fri, null uses org default
  createdAt       DateTime              @default(now()) @map("created_at")

  organizations   OrganizationMember[]
  teams           TeamMember[]
  leaves          Leave[]
  standupResponses StandupResponse[]

  @@map("users")
}

// Organization Member junction table
model OrganizationMember {
  id              String        @id @default(uuid())
  organizationId  String        @map("organization_id")
  userId          String        @map("user_id")
  role            OrgRole       @default(MEMBER)
  isActive        Boolean       @default(true) @map("is_active")
  joinedAt        DateTime      @default(now()) @map("joined_at")

  organization    Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@index([organizationId])
  @@index([userId])
  @@map("organization_members")
}

// Team Member junction table
model TeamMember {
  id        String      @id @default(uuid())
  teamId    String      @map("team_id")
  userId    String      @map("user_id")
  role      TeamRole    @default(MEMBER)
  isActive  Boolean     @default(true) @map("is_active")
  joinedAt  DateTime    @default(now()) @map("joined_at")

  team      Team        @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
  @@index([teamId])
  @@index([userId])
  @@map("team_members")
}

// Leave model
model Leave {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  startDate DateTime  @db.Date @map("start_date")
  endDate   DateTime  @db.Date @map("end_date")
  reason    String?   @db.VarChar(500)
  createdAt DateTime  @default(now()) @map("created_at")

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, startDate, endDate])
  @@map("leaves")
}

// Standup Response model
model StandupResponse {
  id              String    @id @default(uuid())
  teamId          String    @map("team_id")
  userId          String    @map("user_id")
  standupDate     DateTime  @db.Date @map("standup_date")
  yesterdayTasks  String?   @map("yesterday_tasks") @db.Text
  todayTasks      String?   @map("today_tasks") @db.Text
  blockers        String?   @db.Text
  hasBlockers     Boolean   @default(false) @map("has_blockers")
  submittedAt     DateTime  @default(now()) @map("submitted_at")
  isLate          Boolean   @default(false) @map("is_late")

  team            Team      @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId, standupDate])
  @@index([standupDate])
  @@map("standup_responses")
}

// Standup Post model
model StandupPost {
  id              String    @id @default(uuid())
  teamId          String    @map("team_id")
  standupDate     DateTime  @db.Date @map("standup_date")
  slackMessageTs  String?   @map("slack_message_ts")
  channelId       String?   @map("channel_id")
  postedAt        DateTime  @default(now()) @map("posted_at")

  team            Team      @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, standupDate])
  @@map("standup_posts")
}

// Holiday model
model Holiday {
  id        String    @id @default(uuid())
  date      DateTime  @db.Date
  name      String?   @db.VarChar(255)
  country   String    @default("US") @db.VarChar(100)
  createdAt DateTime  @default(now()) @map("created_at")

  @@unique([date, country])
  @@map("holidays")
}

// Enums
enum OrgRole {
  OWNER    // ⚠️ highest admin level
  ADMIN    // ⚠️ organization admin
  MEMBER
}

enum TeamRole {
  ADMIN    // ⚠️ team admin
  MEMBER
}
```

### Step 2.4: Run Migrations ✅

```bash
# Generate Prisma Client and create database tables
npx prisma migrate dev --name init

# For production
npx prisma migrate deploy

# Open Prisma Studio for data management
npx prisma studio
```

### Step 2.5: Manual Organization Setup Script (`scripts/seedOrg.js`) ✅

```javascript
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function seedOrganization() {
  try {
    // Create organization
    const org = await prisma.organization.create({
      data: {
        name: "Your Company Name",
        slackWorkspaceId: "T0123ABCD", // Get from Slack
        slackWorkspaceName: "your-workspace",
        defaultTimezone: "America/New_York",
        settings: {
          defaultWorkDays: [1, 2, 3, 4, 7], // Mon-Thu, Sun (organization default)
          holidayCountry: "US",
          standupWindowMinutes: 30,
        },
      },
    });

    console.log("✅ Organization created:", org.name);
    console.log("Organization ID:", org.id);

    // Optionally create initial admin user ⚠️
    const adminSlackId = "U0123ADMIN"; // Your Slack user ID
    if (adminSlackId) {
      const user = await prisma.user.upsert({
        where: { slackUserId: adminSlackId },
        update: {},
        create: {
          slackUserId: adminSlackId,
          name: "Admin Name",
          email: "admin@company.com",
        },
      });

      await prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      console.log("✅ Admin user added");
    }
  } catch (error) {
    console.error("Error seeding organization:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedOrganization();
```

Run with: `npm run seed` or `node scripts/seedOrg.js`

## Phase 3: Slack App Configuration

### Step 3.1: Create Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: "Daily Dose"
4. Choose workspace

### Step 3.2: Configure OAuth & Permissions

Add these Bot Token Scopes:

- `channels:read`
- `chat:write`
- `chat:write.public`
- `commands`
- `users:read`
- `users:read.email`
- `workflow.steps:execute`
- `im:write`
- `im:read`
- `groups:read`

### Step 3.3: Enable Interactive Components

1. Go to "Interactivity & Shortcuts"
2. Turn on "Interactivity"
3. Add Request URL: `https://your-domain.com/slack/events`

### Step 3.4: Create Slash Commands

**Note**: Commands marked with ⚠️ require admin permissions in your organization.

**Standup Commands:**
- `/dd-standup` - Submit standup manually
- `/dd-standup-update` - Update standup for any day

**Team Management Commands:**
- `/dd-team-create` - Create a new team ⚠️ **(admin only)**
- `/dd-team-update` - Update team settings ⚠️ **(admin only)**
- `/dd-team-join` - Join a team
- `/dd-team-leave` - Leave a team
- `/dd-team-list` - List all teams with member count, reminder time, posting time, and timezone
- `/dd-team-members` - View team members

**Leave Management Commands:**
- `/dd-leave-set` - Set leave dates
- `/dd-leave-list` - List your leaves
- `/dd-leave-cancel` - Cancel leave

**Work Days Commands:**
- `/dd-workdays-set` - Set personal work days
- `/dd-workdays-show` - Show current work days

**Holiday Management Commands ⚠️ (Admin Only):**
- `/dd-holiday-set` - Set holidays ⚠️ **(admin only)**
- `/dd-holiday-update` - Update holiday name ⚠️ **(admin only)**
- `/dd-holiday-delete` - Delete holidays ⚠️ **(admin only)**
- `/dd-holiday-list` - List holidays

## Phase 4: Core Implementation

### Step 4.1: Prisma Client Setup (`src/config/prisma.js`) ✅

```javascript
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
});

module.exports = prisma;
```

### Step 4.2: Main App (`src/app.js`) ✅

```javascript
require("dotenv").config();
const { App, ExpressReceiver } = require("@slack/bolt");
const prisma = require("./config/prisma");
const { setupCommands } = require("./commands");
const { setupWorkflows } = require("./workflows");
const schedulerService = require("./services/schedulerService");

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver
});

// Setup commands and workflows
setupCommands(app);
setupWorkflows(app);

// Initialize scheduler
schedulerService.initialize(app);

// Health check endpoint
receiver.app.get('/health', (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "daily-dose",
  });
});

// Basic health check
app.message("hello", async ({ message, say }) => {
  await say(`Hey there <@${message.user}>! Daily Dose bot is running.`);
});

// Start app
(async () => {
  const port = process.env.PORT || 3000;
  const host = process.env.HOST || "localhost";
  await app.start(port);
  console.log(`⚡️ Daily Dose bot is running on ${host}:${port}`);
})();

// Graceful shutdown
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
```

### Step 4.3: User Service (`src/services/userService.js`) ✅

```javascript
const prisma = require("../config/prisma");

class UserService {
  async findOrCreateUser(slackUserId, userData = {}) {
    return await prisma.user.upsert({
      where: { slackUserId },
      update: {
        name: userData.name,
        email: userData.email,
      },
      create: {
        slackUserId,
        name: userData.name,
        email: userData.email,
        timezone: userData.timezone || process.env.DEFAULT_TIMEZONE,
      },
    });
  }

  async getUserOrganization(slackUserId) {
    const user = await prisma.user.findUnique({
      where: { slackUserId },
      include: {
        organizations: {
          where: { isActive: true },
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user || user.organizations.length === 0) {
      return null;
    }

    return user.organizations[0].organization;
  }

  async canCreateTeam(userId, organizationId) {
    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    return membership && ["OWNER", "ADMIN"].includes(membership.role);
  }

  async setLeave(slackUserId, startDate, endDate, reason) {
    const user = await this.findOrCreateUser(slackUserId);

    return await prisma.leave.create({
      data: {
        userId: user.id,
        startDate,
        endDate,
        reason,
      },
    });
  }

  async setWorkDays(slackUserId, workDays) {
    const user = await this.findOrCreateUser(slackUserId);

    return await prisma.user.update({
      where: { id: user.id },
      data: { workDays },
    });
  }

  async getWorkDays(slackUserId) {
    const user = await prisma.user.findUnique({
      where: { slackUserId },
      select: { workDays: true },
      include: {
        organizations: {
          where: { isActive: true },
          include: {
            organization: {
              select: { settings: true },
            },
          },
        },
      },
    });

    if (!user) return null;

    // Return user-specific work days or organization default
    if (user.workDays) {
      return user.workDays;
    }

    const org = user.organizations[0]?.organization;
    return org?.settings?.defaultWorkDays || [1, 2, 3, 4, 7];
  }

  async cancelLeave(slackUserId, leaveId) {
    const user = await prisma.user.findUnique({
      where: { slackUserId },
    });

    if (!user) return null;

    return await prisma.leave.delete({
      where: {
        id: leaveId,
        userId: user.id,
      },
    });
  }

  async getActiveLeaves(userId, date) {
    return await prisma.leave.findMany({
      where: {
        userId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
  }
}

module.exports = new UserService();
```

### Step 4.4: Team Service (`src/services/teamService.js`) ✅

```javascript
const prisma = require("../config/prisma");
const userService = require("./userService");

class TeamService {
  async createTeam(slackUserId, channelId, teamData) {
    // Get user and their organization
    const user = await userService.findOrCreateUser(slackUserId);
    const org = await userService.getUserOrganization(slackUserId);

    if (!org) {
      throw new Error("You must belong to an organization to create teams");
    }

    // Check permissions (⚠️ admin only)
    const canCreate = await userService.canCreateTeam(user.id, org.id);
    if (!canCreate) {
      throw new Error("You need admin permissions to create teams");
    }

    // Check if channel already has a team
    const existingTeam = await prisma.team.findUnique({
      where: { slackChannelId: channelId },
    });

    if (existingTeam) {
      throw new Error("This channel already has a team");
    }

    // Create team with transaction
    return await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          organizationId: org.id,
          name: teamData.name,
          slackChannelId: channelId,
          standupTime: teamData.standupTime,
          postingTime: teamData.postingTime,
          timezone: teamData.timezone || org.defaultTimezone,
        },
      });

      // Add creator as team admin ⚠️
      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: user.id,
          role: "ADMIN", // ⚠️ admin role
        },
      });

      return team;
    });
  }

  async joinTeam(slackUserId, teamId) {
    const user = await userService.findOrCreateUser(slackUserId);

    // Check if team exists and user's org matches
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { organization: true },
    });

    if (!team) {
      throw new Error("Team not found");
    }

    // Verify user belongs to same organization
    const userOrg = await userService.getUserOrganization(slackUserId);
    if (!userOrg || userOrg.id !== team.organizationId) {
      throw new Error("You can only join teams in your organization");
    }

    // Check if already a member
    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: team.id,
          userId: user.id,
        },
      },
    });

    if (existingMember) {
      throw new Error("You are already a member of this team");
    }

    // Add as member
    return await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: user.id,
        role: "MEMBER",
      },
    });
  }

  async listTeams(slackUserId) {
    const userOrg = await userService.getUserOrganization(slackUserId);

    if (!userOrg) {
      return [];
    }

    return await prisma.team.findMany({
      where: {
        organizationId: userOrg.id,
        isActive: true,
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });
  }

  async getTeamMembers(teamId) {
    return await prisma.teamMember.findMany({
      where: {
        teamId,
        isActive: true,
      },
      include: {
        user: true,
      },
    });
  }

  async getActiveTeamsForScheduling() {
    return await prisma.team.findMany({
      where: {
        isActive: true,
        organization: {
          isActive: true,
        },
      },
      include: {
        organization: true,
      },
    });
  }
}

module.exports = new TeamService();
```

### Step 4.5: Standup Service (`src/services/standupService.js`)

```javascript
const prisma = require("../config/prisma");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const { isWorkingDay } = require("../utils/dateHelper");

dayjs.extend(utc);
dayjs.extend(timezone);

class StandupService {
  async getActiveMembers(teamId, date) {
    const startOfDay = dayjs(date).startOf("day").toDate();
    const endOfDay = dayjs(date).endOf("day").toDate();

    const members = await prisma.teamMember.findMany({
      where: {
        teamId,
        isActive: true,
        user: {
          leaves: {
            none: {
              AND: [
                { startDate: { lte: endOfDay } },
                { endDate: { gte: startOfDay } },
              ],
            },
          },
        },
      },
      include: {
        user: true,
        team: {
          include: {
            organization: true,
          },
        },
      },
    });

    // Filter by user's work days
    const activeMembers = [];
    for (const member of members) {
      const isWorking = await isWorkingDay(
        date,
        member.team.organizationId,
        member.userId
      );
      if (isWorking) {
        activeMembers.push(member);
      }
    }

    return activeMembers;
  }

  async saveResponse(teamId, slackUserId, responseData, isLate = false) {
    const user = await prisma.user.findUnique({
      where: { slackUserId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const standupDate = dayjs(responseData.date).startOf("day").toDate();

    return await prisma.standupResponse.upsert({
      where: {
        teamId_userId_standupDate: {
          teamId,
          userId: user.id,
          standupDate,
        },
      },
      update: {
        yesterdayTasks: responseData.yesterdayTasks,
        todayTasks: responseData.todayTasks,
        blockers: responseData.blockers,
        hasBlockers: !!responseData.blockers,
        isLate,
        submittedAt: new Date(),
      },
      create: {
        teamId,
        userId: user.id,
        standupDate,
        yesterdayTasks: responseData.yesterdayTasks,
        todayTasks: responseData.todayTasks,
        blockers: responseData.blockers,
        hasBlockers: !!responseData.blockers,
        isLate,
      },
    });
  }

  async getTeamResponses(teamId, date) {
    const startOfDay = dayjs(date).startOf("day").toDate();
    const endOfDay = dayjs(date).endOf("day").toDate();

    return await prisma.standupResponse.findMany({
      where: {
        teamId,
        standupDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        isLate: false,
      },
      include: {
        user: true,
      },
      orderBy: {
        submittedAt: "asc",
      },
    });
  }

  async getLateResponses(teamId, date) {
    const startOfDay = dayjs(date).startOf("day").toDate();
    const endOfDay = dayjs(date).endOf("day").toDate();

    return await prisma.standupResponse.findMany({
      where: {
        teamId,
        standupDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        isLate: true,
      },
      include: {
        user: true,
      },
      orderBy: {
        submittedAt: "asc",
      },
    });
  }

  async saveStandupPost(teamId, date, messageTs, channelId) {
    const standupDate = dayjs(date).startOf("day").toDate();

    return await prisma.standupPost.upsert({
      where: {
        teamId_standupDate: {
          teamId,
          standupDate,
        },
      },
      update: {
        slackMessageTs: messageTs,
        channelId,
        postedAt: new Date(),
      },
      create: {
        teamId,
        standupDate,
        slackMessageTs: messageTs,
        channelId,
        postedAt: new Date(),
      },
    });
  }

  async getStandupPost(teamId, date) {
    const standupDate = dayjs(date).startOf("day").toDate();

    return await prisma.standupPost.findUnique({
      where: {
        teamId_standupDate: {
          teamId,
          standupDate,
        },
      },
    });
  }

  async formatStandupMessage(responses, notSubmitted) {
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `📊 Daily Standup - ${dayjs().format("MMM DD, YYYY")}`,
        },
      },
      {
        type: "divider",
      },
    ];

    // Add responses
    if (responses.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*✅ Submitted (${responses.length}):*`,
        },
      });

      for (const response of responses) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*👤 ${
              response.user.name ||
              response.user.username ||
              response.user.slackUserId
            }*`,
          },
        });

        let responseText = "";

        if (response.yesterdayTasks) {
          responseText += `*Last Working Day:*\n${response.yesterdayTasks}\n\n`;
        }

        if (response.todayTasks) {
          responseText += `*Today:*\n${response.todayTasks}\n\n`;
        }

        if (response.blockers) {
          responseText += `*Blockers:* ${response.blockers}`;
        } else {
          responseText += `*Blockers:* None`;
        }

        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: responseText,
          },
        });

        blocks.push({
          type: "divider",
        });
      }
    }

    // Add not submitted section
    if (notSubmitted.length > 0) {
      const notSubmittedText = notSubmitted
        .map((m) => {
          if (m.onLeave) {
            return `• <@${m.slackUserId}> (On leave)`;
          }
          return `• <@${m.slackUserId}> (No response)`;
        })
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📝 Not Submitted:*\n${notSubmittedText}`,
        },
      });
    }

    return { blocks };
  }
}

module.exports = new StandupService();
```

### Step 4.6: Holiday Commands (`src/commands/holiday.js`) ✅

```javascript
const prisma = require("../config/prisma");
const userService = require("../services/userService");
const { ackWithProcessing } = require("../utils/commandHelper");
const { createSectionBlock } = require("../utils/blockHelper");
const dayjs = require("dayjs");

async function setHoliday({ command, ack, respond, client }) {
  const updateResponse = ackWithProcessing(
    ack,
    respond,
    "Setting holiday...",
    command
  );

  try {
    // Check admin permissions ⚠️
    const userData = await userService.fetchSlackUserData(
      command.user_id,
      client
    );
    const user = await userService.findOrCreateUser(command.user_id, userData);
    const org = await userService.getUserOrganization(command.user_id);

    if (!org) {
      await updateResponse({
        text: "❌ You must belong to an organization to manage holidays",
      });
      return;
    }

    const canManage = await userService.canCreateTeam(user.id, org.id);
    if (!canManage) {
      await updateResponse({
        text: "❌ You need admin permissions to manage holidays",
      });
      return;
    }

    // Parse command: /dd-holiday-set YYYY-MM-DD [YYYY-MM-DD] [name]
    const args = command.text.trim().split(" ");

    if (args.length < 1 || !args[0]) {
      await updateResponse({
        text: "❌ Usage: `/dd-holiday-set YYYY-MM-DD [YYYY-MM-DD] [name]`\nExamples:\n- `/dd-holiday-set 2024-12-25 Christmas Day`\n- `/dd-holiday-set 2024-12-24 2024-12-26 Christmas Holiday`",
      });
      return;
    }

    // Implementation details for holiday setting...
    // (Full implementation available in actual codebase)
  } catch (error) {
    await updateResponse({
      text: `❌ Error: ${error.message}`,
    });
  }
}

module.exports = {
  setHoliday,
  updateHoliday,
  deleteHoliday,
  listHolidays,
};
```

### Step 4.7: Middleware (`src/middleware/command.js`) ✅

```javascript
/**
 * Middleware to strip Slack's automatic formatting from command text
 * Slack automatically adds formatting like <@U123456> for mentions
 * and <#C123456|channel-name> for channels, which we need to clean
 */
function stripFormatting() {
  return async ({ command, next }) => {
    if (command.text) {
      // Remove user mentions: <@U123456> -> @username
      command.text = command.text.replace(/<@([UW][A-Z0-9]+)(\|([^>]+))?>/g, '@$3');
      
      // Remove channel mentions: <#C123456|channel-name> -> #channel-name
      command.text = command.text.replace(/<#([CD][A-Z0-9]+)(\|([^>]+))?>/g, '#$3');
      
      // Remove link formatting: <https://example.com|example.com> -> https://example.com
      command.text = command.text.replace(/<(https?:\/\/[^|>]+)(\|([^>]+))?>/g, '$1');
      
      // Remove special characters used by Slack
      command.text = command.text.replace(/&lt;/g, '<')
                                 .replace(/&gt;/g, '>')
                                 .replace(/&amp;/g, '&');
    }
    
    await next();
  };
}

module.exports = { stripFormatting };
```

### Step 4.8: Scheduler Service (`src/services/schedulerService.js`)

```javascript
const cron = require("node-cron");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const prisma = require("../config/prisma");
const teamService = require("./teamService");
const standupService = require("./standupService");
const { isWorkingDay } = require("../utils/dateHelper");

dayjs.extend(utc);
dayjs.extend(timezone);

class SchedulerService {
  constructor() {
    this.scheduledJobs = new Map();
    this.app = null;
  }

  async initialize(app) {
    this.app = app;
    await this.scheduleAllTeams();

    // Refresh schedules daily at midnight
    cron.schedule("0 0 * * *", async () => {
      await this.scheduleAllTeams();
    });
  }

  async scheduleAllTeams() {
    console.log("📅 Scheduling standup reminders for all teams...");

    const teams = await teamService.getActiveTeamsForScheduling();

    for (const team of teams) {
      await this.scheduleTeam(team);
    }
  }

  async scheduleTeam(team) {
    const { standupTime, postingTime, timezone } = team;

    // Parse times
    const standupHour = parseInt(standupTime.split(":")[0]);
    const standupMinute = parseInt(standupTime.split(":")[1]);
    const postingHour = parseInt(postingTime.split(":")[0]);
    const postingMinute = parseInt(postingTime.split(":")[1]);

    // Schedule standup reminder
    const standupCron = `${standupMinute} ${standupHour} * * 1-5`; // Mon-Fri
    const standupJobId = `standup-${team.id}`;

    // Cancel existing job if any
    if (this.scheduledJobs.has(standupJobId)) {
      this.scheduledJobs.get(standupJobId).stop();
    }

    const standupJob = cron.schedule(
      standupCron,
      async () => {
        await this.sendStandupReminders(team);
      },
      {
        timezone,
        scheduled: true,
      }
    );

    this.scheduledJobs.set(standupJobId, standupJob);

    // Schedule follow-up reminder (15 minutes later)
    const followupTime = dayjs()
      .hour(standupHour)
      .minute(standupMinute)
      .add(15, "minute");

    const followupCron = `${followupTime.minute()} ${followupTime.hour()} * * 1-5`;
    const followupJobId = `followup-${team.id}`;

    if (this.scheduledJobs.has(followupJobId)) {
      this.scheduledJobs.get(followupJobId).stop();
    }

    const followupJob = cron.schedule(
      followupCron,
      async () => {
        await this.sendFollowupReminders(team);
      },
      {
        timezone,
        scheduled: true,
      }
    );

    this.scheduledJobs.set(followupJobId, followupJob);

    // Schedule posting time
    const postingCron = `${postingMinute} ${postingHour} * * 1-5`;
    const postingJobId = `posting-${team.id}`;

    if (this.scheduledJobs.has(postingJobId)) {
      this.scheduledJobs.get(postingJobId).stop();
    }

    const postingJob = cron.schedule(
      postingCron,
      async () => {
        await this.postTeamStandup(team);
      },
      {
        timezone,
        scheduled: true,
      }
    );

    this.scheduledJobs.set(postingJobId, postingJob);

    console.log(`✅ Scheduled team: ${team.name} (${timezone})`);
  }

  async sendStandupReminders(team) {
    const now = dayjs().tz(team.timezone);

    // Check if working day
    const isWorking = await isWorkingDay(now.toDate(), team.organizationId);
    if (!isWorking) return;

    // Get active members
    const members = await standupService.getActiveMembers(
      team.id,
      now.toDate()
    );

    for (const member of members) {
      try {
        await this.app.client.chat.postMessage({
          channel: member.user.slackUserId,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `🌅 Good morning! Time for your daily standup for *${team.name}*`,
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "📝 Submit Standup",
                  },
                  action_id: `open_standup_${team.id}`,
                  style: "primary",
                },
              ],
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `⏰ Deadline: ${formatTime12Hour(team.postingTime)}`,
                },
              ],
            },
          ],
        });
      } catch (error) {
        console.error(
          `Failed to send reminder to ${member.user.slackUserId}:`,
          error
        );
      }
    }
  }

  async sendFollowupReminders(team) {
    const now = dayjs().tz(team.timezone);

    // Check if working day
    const isWorking = await isWorkingDay(now.toDate(), team.organizationId);
    if (!isWorking) return;

    // Get members who haven't responded
    const members = await standupService.getActiveMembers(
      team.id,
      now.toDate()
    );
    const responses = await standupService.getTeamResponses(
      team.id,
      now.toDate()
    );

    const respondedUserIds = new Set(responses.map((r) => r.userId));
    const pendingMembers = members.filter(
      (m) => !respondedUserIds.has(m.userId)
    );

    for (const member of pendingMembers) {
      try {
        await this.app.client.chat.postMessage({
          channel: member.user.slackUserId,
          text: `⏰ Reminder: Please submit your standup for ${
            team.name
          } before ${formatTime12Hour(team.postingTime)}`,
        });
      } catch (error) {
        console.error(
          `Failed to send follow-up to ${member.user.slackUserId}:`,
          error
        );
      }
    }
  }

  async postTeamStandup(team) {
    const now = dayjs().tz(team.timezone);

    // Check if working day
    const isWorking = await isWorkingDay(now.toDate(), team.organizationId);
    if (!isWorking) return;

    // Get all responses
    const responses = await standupService.getTeamResponses(
      team.id,
      now.toDate()
    );
    const allMembers = await standupService.getActiveMembers(
      team.id,
      now.toDate()
    );

    // Get members on leave
    const membersOnLeave = await prisma.teamMember.findMany({
      where: {
        teamId: team.id,
        isActive: true,
        user: {
          leaves: {
            some: {
              startDate: { lte: now.toDate() },
              endDate: { gte: now.toDate() },
            },
          },
        },
      },
      include: {
        user: true,
      },
    });

    // Calculate not submitted
    const respondedUserIds = new Set(responses.map((r) => r.userId));
    const leaveUserIds = new Set(membersOnLeave.map((m) => m.userId));

    const notSubmitted = allMembers
      .filter((m) => !respondedUserIds.has(m.userId))
      .map((m) => ({
        slackUserId: m.user.slackUserId,
        onLeave: leaveUserIds.has(m.userId),
      }));

    // Format and post message
    const message = await standupService.formatStandupMessage(
      responses,
      notSubmitted
    );

    try {
      const result = await this.app.client.chat.postMessage({
        channel: team.slackChannelId,
        ...message,
      });

      // Save message timestamp for threading late responses
      await standupService.saveStandupPost(
        team.id,
        now.toDate(),
        result.ts,
        team.slackChannelId
      );
    } catch (error) {
      console.error(`Failed to post standup for team ${team.name}:`, error);
    }
  }
}

module.exports = new SchedulerService();
```

### Step 4.7: Date Helper (`src/utils/dateHelper.js`) ✅

```javascript
const prisma = require("../config/prisma");
const dayjs = require("dayjs");
const weekday = require("dayjs/plugin/weekday");

dayjs.extend(weekday);

async function isWorkingDay(date, organizationId, userId = null) {
  const dt = dayjs(date);

  // Get work days - user-specific or organization default
  let workDays;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { workDays: true },
    });
    workDays = user?.workDays || null;
  }

  if (!workDays) {
    // Use organization default
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    workDays = org?.settings?.defaultWorkDays || [1, 2, 3, 4, 7];
  }

  // Check if current day is a work day (Day.js weekday: 0=Sunday, 1=Monday, etc.)
  // Convert to match Luxon format (1=Monday, 7=Sunday)
  const dayOfWeek = dt.day() === 0 ? 7 : dt.day();
  if (!workDays.includes(dayOfWeek)) {
    return false;
  }

  // Check holidays
  const holiday = await prisma.holiday.findFirst({
    where: {
      date: {
        gte: dt.startOf("day").toDate(),
        lte: dt.endOf("day").toDate(),
      },
    },
  });

  if (holiday) {
    return false;
  }

  return true;
}

module.exports = {
  isWorkingDay,
};
```

## Phase 5: Commands Implementation

### Step 5.1: Setup Commands (`src/commands/index.js`) ✅

```javascript
const teamCommands = require("./team");
const leaveCommands = require("./leave");
const standupCommands = require("./standup");
const holidayCommands = require("./holiday");
const { stripFormatting } = require("../middleware/command");

function setupCommands(app) {
  // Standup commands (primary functionality) - wrapped with formatting removal middleware
  app.command("/dd-standup", stripFormatting(), standupCommands.submitManual);
  app.command("/dd-standup-update", stripFormatting(), standupCommands.updateStandup);

  // Team management commands - wrapped with formatting removal middleware
  app.command("/dd-team-list", stripFormatting(), teamCommands.listTeams);
  app.command("/dd-team-join", stripFormatting(), teamCommands.joinTeam);
  app.command("/dd-team-leave", stripFormatting(), teamCommands.leaveTeam);
  app.command("/dd-team-members", stripFormatting(), teamCommands.listMembers);
  app.command("/dd-team-create", stripFormatting(), teamCommands.createTeam); // ⚠️ admin only
  app.command("/dd-team-update", stripFormatting(), teamCommands.updateTeam); // ⚠️ admin only

  // Leave management commands - wrapped with formatting removal middleware
  app.command("/dd-leave-list", stripFormatting(), leaveCommands.listLeaves);
  app.command("/dd-leave-set", stripFormatting(), leaveCommands.setLeave);
  app.command("/dd-leave-cancel", stripFormatting(), leaveCommands.cancelLeave);

  // Work days configuration commands - wrapped with formatting removal middleware
  app.command("/dd-workdays-show", stripFormatting(), leaveCommands.showWorkDays);
  app.command("/dd-workdays-set", stripFormatting(), leaveCommands.setWorkDays);

  // Holiday management commands - wrapped with formatting removal middleware ⚠️ admin only
  app.command("/dd-holiday-set", stripFormatting(), holidayCommands.setHoliday);
  app.command("/dd-holiday-update", stripFormatting(), holidayCommands.updateHoliday);
  app.command("/dd-holiday-delete", stripFormatting(), holidayCommands.deleteHoliday);
  app.command("/dd-holiday-list", stripFormatting(), holidayCommands.listHolidays);

  // Interactive components (no formatting removal needed for these)
  app.action(/open_standup_.*/, standupCommands.openStandupModal);
  app.view("standup_modal", standupCommands.handleStandupSubmission);
  app.view("standup_update_modal", standupCommands.handleStandupUpdateSubmission);

  console.log("✅ Commands registered with formatting removal middleware");
}

module.exports = { setupCommands };
```

### Step 5.2: Team Commands (`src/commands/team.js`) ✅

```javascript
const teamService = require("../services/teamService");

async function createTeam({ command, ack, respond }) {
  await ack();

  try {
    // Parse command text: /dd-team-create TeamName 09:30 10:00 (⚠️ admin only)
    const [name, standupTime, postingTime] = command.text.split(" ");

    if (!name || !standupTime || !postingTime) {
      await respond({
        text: "❌ Usage: `/dd-team-create TeamName HH:MM HH:MM`\nExample: `/dd-team-create Engineering 09:30 10:00`",
      });
      return;
    }

    const team = await teamService.createTeam(
      command.user_id,
      command.channel_id,
      {
        name,
        standupTime,
        postingTime,
      }
    );

    await respond({
      text: `✅ Team "${name}" created successfully!\n• Standup reminder: ${formatTime12Hour(
        standupTime
      )}\n• Posting time: ${formatTime12Hour(postingTime)}`,
    });
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function joinTeam({ command, ack, respond }) {
  await ack();

  try {
    const teamName = command.text.trim();

    if (!teamName) {
      await respond({
        text: "❌ Usage: `/dd-team-join TeamName`",
      });
      return;
    }

    // Find team by name
    const teams = await teamService.listTeams(command.user_id);
    const team = teams.find(
      (t) => t.name.toLowerCase() === teamName.toLowerCase()
    );

    if (!team) {
      await respond({
        text: `❌ Team "${teamName}" not found`,
      });
      return;
    }

    await teamService.joinTeam(command.user_id, team.id);

    await respond({
      text: `✅ You've joined team "${team.name}"!`,
    });
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function listTeams({ command, ack, respond }) {
  await ack();

  try {
    const teams = await teamService.listTeams(command.user_id);

    if (teams.length === 0) {
      await respond({
        text: "📋 No teams found in your organization",
      });
      return;
    }

    const teamList = teams
      .map(
        (t) =>
          `• *${t.name}* (${
            t._count.members
          } members)\n  🔔 Reminder: ${formatTime12Hour(
            t.standupTime
          )} | 📊 Posting: ${formatTime12Hour(t.postingTime)} | 🌍 ${
            t.timezone
          }`
      )
      .join("\n\n");

    await respond({
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📋 Teams in your organization:*\n\n${teamList}`,
          },
        },
      ],
    });
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

module.exports = {
  createTeam,
  joinTeam,
  listTeams,
};
```

### Step 5.3: Leave Commands (`src/commands/leave.js`) ✅

```javascript
const userService = require("../services/userService");
const prisma = require("../config/prisma");
const dayjs = require("dayjs");

async function setLeave({ command, ack, respond }) {
  await ack();

  try {
    // Parse command: /dd-leave-set 2024-12-25 2024-12-26 Holiday break
    const parts = command.text.trim().split(" ");

    if (parts.length < 2) {
      await respond({
        text: "❌ Usage: `/dd-leave-set YYYY-MM-DD YYYY-MM-DD [reason]`\nExample: `/dd-leave-set 2024-12-25 2024-12-26 Holiday break`",
      });
      return;
    }

    const startDate = dayjs(parts[0]);
    const endDate = dayjs(parts[1]);

    const reason = parts.slice(2).join(" ") || "Personal leave";

    if (!startDate.isValid() || !endDate.isValid()) {
      await respond({
        text: "❌ Invalid date format. Use YYYY-MM-DD",
      });
      return;
    }

    if (endDate.isBefore(startDate)) {
      await respond({
        text: "❌ End date cannot be before start date",
      });
      return;
    }

    await userService.setLeave(
      command.user_id,
      startDate.toDate(),
      endDate.toDate(),
      reason
    );

    const dateRange = startDate.isSame(endDate, "day")
      ? startDate.format("MMM DD, YYYY")
      : `${startDate.format("MMM DD, YYYY")} - ${endDate.format(
          "MMM DD, YYYY"
        )}`;

    await respond({
      text: `✅ Leave set for ${dateRange}\nReason: ${reason}`,
    });
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function cancelLeave({ command, ack, respond }) {
  await ack();

  try {
    const user = await userService.findOrCreateUser(command.user_id);

    // Get user's upcoming leaves
    const leaves = await prisma.leave.findMany({
      where: {
        userId: user.id,
        endDate: {
          gte: new Date(),
        },
      },
      orderBy: {
        startDate: "asc",
      },
    });

    if (leaves.length === 0) {
      await respond({
        text: "📅 You have no upcoming leaves to cancel",
      });
      return;
    }

    const leaveList = leaves
      .map((leave, index) => {
        const startDate = dayjs(leave.startDate).format("MMM DD, YYYY");
        const endDate = dayjs(leave.endDate).format("MMM DD, YYYY");

        const dateRange =
          startDate === endDate ? startDate : `${startDate} - ${endDate}`;

        return `${index + 1}. ${dateRange} - ${leave.reason}`;
      })
      .join("\n");

    await respond({
      text: `📅 Your upcoming leaves:\n${leaveList}\n\nTo cancel a leave, reply with the number (e.g., "1")`,
    });

    // Note: In a full implementation, you'd handle the follow-up response
    // This would require storing state or using interactive components
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function setWorkDays({ command, ack, respond }) {
  await ack();

  try {
    const workDaysText = command.text.trim();

    if (!workDaysText) {
      await respond({
        text: "❌ Usage: `/dd-workdays-set 1,2,3,4,5`\nNumbers: 1=Monday, 2=Tuesday, ..., 7=Sunday",
      });
      return;
    }

    const workDays = workDaysText
      .split(",")
      .map((day) => parseInt(day.trim()))
      .filter((day) => day >= 1 && day <= 7);

    if (workDays.length === 0) {
      await respond({
        text: "❌ Invalid work days. Use numbers 1-7 (1=Monday, 7=Sunday)",
      });
      return;
    }

    await userService.setWorkDays(command.user_id, workDays);

    const dayNames = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
      7: "Sunday",
    };

    const workDayNames = workDays
      .sort()
      .map((day) => dayNames[day])
      .join(", ");

    await respond({
      text: `✅ Work days updated: ${workDayNames}`,
    });
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function showWorkDays({ command, ack, respond }) {
  await ack();

  try {
    const workDays = await userService.getWorkDays(command.user_id);

    if (!workDays) {
      await respond({
        text: "❌ Unable to retrieve work days",
      });
      return;
    }

    const dayNames = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
      7: "Sunday",
    };

    const workDayNames = workDays
      .sort()
      .map((day) => dayNames[day])
      .join(", ");

    await respond({
      text: `📅 Your work days: ${workDayNames}`,
    });
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

module.exports = {
  setLeave,
  cancelLeave,
  setWorkDays,
  showWorkDays,
};
```

### Step 5.4: Standup Commands (`src/commands/standup.js`) ✅

```javascript
const standupService = require("../services/standupService");
const teamService = require("../services/teamService");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

async function submitManual({ command, ack, respond }) {
  await ack();

  try {
    // Get user's teams
    const teams = await teamService.listTeams(command.user_id);

    if (teams.length === 0) {
      await respond({
        text: "❌ You're not a member of any teams. Join a team first with `/dd-team-join`",
      });
      return;
    }

    // If user is in multiple teams, show selection
    if (teams.length > 1) {
      const teamOptions = teams.map((team) => ({
        text: {
          type: "plain_text",
          text: team.name,
        },
        value: team.id,
      }));

      await respond({
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "📝 Select a team for your standup:",
            },
            accessory: {
              type: "static_select",
              placeholder: {
                type: "plain_text",
                text: "Choose team...",
              },
              options: teamOptions,
              action_id: "select_team_standup",
            },
          },
        ],
      });
      return;
    }

    // Single team - open modal directly
    const team = teams[0];
    await openStandupModal({
      body: { user: { id: command.user_id } },
      client: respond.client,
      action: { value: team.id },
    });
  } catch (error) {
    await respond({
      text: `❌ Error: ${error.message}`,
    });
  }
}

async function openStandupModal({ body, client, action }) {
  try {
    const teamId = action.action_id
      ? action.action_id.replace("open_standup_", "")
      : action.value;

    const today = dayjs().format("MMM DD, YYYY");

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "standup_modal",
        private_metadata: JSON.stringify({ teamId }),
        title: {
          type: "plain_text",
          text: "Daily Standup",
        },
        submit: {
          type: "plain_text",
          text: "Submit",
        },
        close: {
          type: "plain_text",
          text: "Cancel",
        },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `📅 *${today}*`,
            },
          },
          {
            type: "divider",
          },
          {
            type: "input",
            block_id: "yesterday_block",
            element: {
              type: "plain_text_input",
              action_id: "yesterday_input",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "What did you work on yesterday?",
              },
            },
            label: {
              type: "plain_text",
              text: "Last Working Day's Tasks",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "today_block",
            element: {
              type: "plain_text_input",
              action_id: "today_input",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "What are you working on today?",
              },
            },
            label: {
              type: "plain_text",
              text: "Today's Tasks",
            },
            optional: true,
          },
          {
            type: "input",
            block_id: "blockers_block",
            element: {
              type: "plain_text_input",
              action_id: "blockers_input",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "Any blockers or help needed?",
              },
            },
            label: {
              type: "plain_text",
              text: "Blockers",
            },
            optional: true,
          },
        ],
      },
    });
  } catch (error) {
    console.error("Error opening standup modal:", error);
  }
}

async function handleStandupSubmission({ ack, body, client, view }) {
  await ack();

  try {
    const { teamId } = JSON.parse(view.private_metadata);

    const values = view.state.values;
    const yesterdayTasks = values.yesterday_block?.yesterday_input?.value || "";
    const todayTasks = values.today_block?.today_input?.value || "";
    const blockers = values.blockers_block?.blockers_input?.value || "";

    // Determine if submission is late
    const now = dayjs();

    const teams = await teamService.listTeams(body.user.id);
    const team = teams.find((t) => t.id === teamId);

    let isLate = false;
    if (team) {
      const [hour, minute] = team.postingTime.split(":");
      const deadline = dayjs().hour(parseInt(hour)).minute(parseInt(minute));
      isLate = now.isAfter(deadline);
    }

    await standupService.saveResponse(
      teamId,
      body.user.id,
      {
        date: now.toDate(),
        yesterdayTasks,
        todayTasks,
        blockers,
      },
      isLate
    );

    // Send confirmation message
    await client.chat.postMessage({
      channel: body.user.id,
      text: `✅ Standup submitted successfully!${
        isLate ? " (Late submission)" : ""
      }`,
    });

    // If late, post to team channel as thread
    if (isLate && team) {
      const standupPost = await standupService.getStandupPost(
        teamId,
        now.toDate()
      );

      if (standupPost?.slackMessageTs) {
        let lateMessage = `*👤 ${
          body.user.name || body.user.id
        }* (Late submission)`;

        if (yesterdayTasks) {
          lateMessage += `\n*Last Working Day:*\n${yesterdayTasks}`;
        }

        if (todayTasks) {
          lateMessage += `\n*Today:*\n${todayTasks}`;
        }

        if (blockers) {
          lateMessage += `\n*Blockers:* ${blockers}`;
        } else {
          lateMessage += `\n*Blockers:* None`;
        }

        await client.chat.postMessage({
          channel: standupPost.channelId,
          thread_ts: standupPost.slackMessageTs,
          text: lateMessage,
        });
      }
    }
  } catch (error) {
    console.error("Error handling standup submission:", error);

    await client.chat.postMessage({
      channel: body.user.id,
      text: "❌ Error submitting standup. Please try again.",
    });
  }
}

module.exports = {
  submitManual,
  openStandupModal,
  handleStandupSubmission,
};
```

## Phase 6: Testing & Deployment

### Step 6.1: Local Testing

```bash
# Start with nodemon for development
npx nodemon src/app.js

# Use ngrok for Slack webhooks
ngrok http 3000
```

### Step 6.2: Test Scenarios

1. **Organization Setup**: Run seed script
2. **Team Creation** ⚠️ **(Admin Only)**: Create teams with different times
3. **Member Management**: Join teams, verify permissions
4. **Standup Flow**: Test reminders and submissions
5. **Leave Management**: Set leaves, verify exclusion
6. **Posting**: Check message formatting

### Step 6.3: Production Deployment

```bash
# Build for production
npm run build

# Run migrations
npx prisma migrate deploy

# Start with PM2
pm2 start src/app.js --name daily-dose
```

## Phase 7: Monitoring & Maintenance

### Database Queries with Prisma Studio

```bash
# Open visual database browser
npx prisma studio
```

### Common Prisma Commands

```bash
# Reset database (careful!)
npx prisma migrate reset

# Generate client after schema changes
npx prisma generate

# Format schema file
npx prisma format

# Validate schema
npx prisma validate
```

## Phase 8: Work Days Management

### User-Specific Work Days

The system supports individual work day preferences while maintaining organization defaults:

#### Organization Level

- Default work days are set in organization settings: `defaultWorkDays: [1,2,3,4,5]`
- Used as fallback when users haven't set personal preferences

#### User Level

- Users can override organization defaults with personal work days
- Set via `/dd-workdays-set 1,2,3,4,5` command
- View current settings with `/dd-workdays-show`

#### Implementation Benefits

- **Flexible Scheduling**: Accommodates part-time workers, different schedules
- **Automatic Filtering**: Only sends reminders on user's work days
- **Smart Posting**: Considers individual schedules for team summaries
- **Leave Integration**: Works seamlessly with leave management

#### Usage Examples

```bash
# Set work days (Monday-Thursday, Sunday - default)
/dd-workdays-set 1,2,3,4,7

# Set work days (Monday-Friday, traditional)
/dd-workdays-set 1,2,3,4,5

# Set work days (Monday-Thursday, part-time)
/dd-workdays-set 1,2,3,4

# Set work days (Tuesday-Saturday)
/dd-workdays-set 2,3,4,5,6

# View current work days
/dd-workdays-show
```

## Future Enhancements

1. **Analytics Dashboard**

   - Participation rates by team/org
   - Response time patterns
   - Blocker trends
   - Work day compliance metrics

2. **Advanced Features**

   - Custom questions per team
   - Weekly summaries
   - Integration with Jira/Trello
   - AI-powered insights
   - Flexible work schedules (different days per week)

3. **Admin Panel** ⚠️ **(Admin Only)**
   - Web interface for org management
   - Bulk user operations
   - Report generation
   - Work day analytics

## Benefits of This Architecture

1. **Type Safety**: Prisma provides complete type safety
2. **Scalability**: Multi-tenant ready
3. **Maintainability**: Clean separation of concerns
4. **Performance**: Optimized queries with Prisma
5. **Developer Experience**: Excellent tooling and debugging

## Resources

- [Slack Bolt Documentation](https://slack.dev/bolt-js)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Node Cron Documentation](https://github.com/node-cron/node-cron)
