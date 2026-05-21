# Graph Report - /Users/nahian/Projects/daily-dose-bot (2026-05-20)

## Corpus Check

- 138 files · ~130,252 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 546 nodes · 815 edges · 24 communities detected
- Extraction: 74% EXTRACTED · 25% INFERRED · 0% AMBIGUOUS · INFERRED: 207 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- [[_COMMUNITY_Changelog & Hardening History|Changelog & Hardening History]]
- [[_COMMUNITY_Codebase Hardening Plans|Codebase Hardening Plans]]
- [[_COMMUNITY_Slash Command Handlers|Slash Command Handlers]]
- [[_COMMUNITY_Web Landing & Config|Web Landing & Config]]
- [[_COMMUNITY_Block Kit & Messaging Helpers|Block Kit & Messaging Helpers]]
- [[_COMMUNITY_Standup Workflow Handlers|Standup Workflow Handlers]]
- [[_COMMUNITY_Standup Service|Standup Service]]
- [[_COMMUNITY_Team Service|Team Service]]
- [[_COMMUNITY_User & Org Service|User & Org Service]]
- [[_COMMUNITY_Scheduler Service|Scheduler Service]]
- [[_COMMUNITY_Slack Manifest Manager|Slack Manifest Manager]]
- [[_COMMUNITY_Logger Utility|Logger Utility]]
- [[_COMMUNITY_Project Setup & Tooling|Project Setup & Tooling]]
- [[_COMMUNITY_Manual Standup Script|Manual Standup Script]]
- [[_COMMUNITY_Docs Page Scripts|Docs Page Scripts]]
- [[_COMMUNITY_Landing Page Scripts|Landing Page Scripts]]
- [[_COMMUNITY_Standup Trigger Script|Standup Trigger Script]]
- [[_COMMUNITY_Holiday Command Plans|Holiday Command Plans]]
- [[_COMMUNITY_Brand Identity Assets|Brand Identity Assets]]
- [[_COMMUNITY_Notification Service|Notification Service]]
- [[_COMMUNITY_Command Registration|Command Registration]]
- [[_COMMUNITY_BasicAuth Middleware|BasicAuth Middleware]]
- [[_COMMUNITY_Standup Update Command|Standup Update Command]]
- [[_COMMUNITY_Framework Logos|Framework Logos]]

## God Nodes (most connected - your core abstractions)

1. `createCommandErrorBlocks()` - 32 edges
2. `createSectionBlock()` - 30 edges
3. `ackWithProcessing()` - 30 edges
4. `sanitizeError()` - 27 edges
5. `TeamService` - 19 edges
6. `UserService` - 18 edges
7. `StandupService` - 15 edges
8. `Daily Dose Changelog` - 15 edges
9. `SchedulerService` - 14 edges
10. `postStandup()` - 13 edges

## Surprising Connections (you probably didn't know these)

- `public/changelog.html Version History Page` --semantically_similar_to--> `Daily Dose Changelog` [INFERRED] [semantically similar]
  public/changelog.html → CHANGELOG.md
- `Web Migration Plan (HTML to React Router v7)` --semantically_similar_to--> `React SPA Web Frontend` [INFERRED] [semantically similar]
  WEB_MIGRATION_PLAN.md → CLAUDE.md
- `BasicAuth.tsx Component` --semantically_similar_to--> `Server-side BasicAuth Middleware` [INFERRED] [semantically similar]
  web/SCRIPTS_AUTH.md → CHANGELOG.md
- `public/docs.html User Documentation` --semantically_similar_to--> `Slash Commands (/dd-*)` [INFERRED] [semantically similar]
  public/README.md → README.md
- `permissionHelper.js` --semantically_similar_to--> `Role-Based Permissions (Admin/Owner)` [INFERRED] [semantically similar]
  CLAUDE.md → README.md

## Hyperedges (group relationships)

- **Core Business Logic Services** — claude_scheduler_service, claude_standup_service, claude_team_service, claude_user_service [EXTRACTED 0.85]
- **Production Deployment Pipeline** — deployment_github_actions_workflow, deployment_pm2, deployment_nginx_reverse_proxy, deployment_supabase_setup [EXTRACTED 0.80]
- **HTML Landing Pages Migrated to React** — public_index_html_landing_page, public_readme_docs_html, public_readme_scripts_docs_html, public_changelog_html_changelog_page, web_migration_plan_web_migration [EXTRACTED 0.80]
- **Manual Standup Trigger Command Suite** — manual_standup_triggers_implementation_dd_standup_remind, manual_standup_triggers_implementation_dd_standup_post, manual_standup_triggers_implementation_dd_standup_preview, manual_standup_triggers_implementation_dd_standup_followup [EXTRACTED 1.00]
- **May 2026 Codebase Hardening Plan Series** — 2026_05_19_security_correctness_hardening_plan, 2026_05_19_query_performance_plan, 2026_05_19_observability_and_reliability_plan, 2026_05_19_dx_and_tooling_plan [EXTRACTED 0.90]
- **Admin Standup Notification Pipeline** — admin_notification_plan_get_team_admins, admin_notification_plan_notify_admins_of_standup_submission, admin_notification_plan_send_admin_notification, admin_notification_opt_out_plan_receive_notifications_field [INFERRED 0.80]
- **Daily Dose Bot Brand Identity Asset Set** — favicon_16x16_daily_dose_favicon, favicon_32x32_daily_dose_favicon, android_chrome_192x192_daily_dose_app_icon, android_chrome_512x512_daily_dose_app_icon, apple_touch_icon_daily_dose_app_icon, logo_daily_dose_logo, logo_daily_dose_root_logo [EXTRACTED 0.95]

## Communities

### Community 0 - "Changelog & Hardening History"

Cohesion: 0.05
Nodes (50): Auto-suspension on Slack User Deactivation, Server-side BasicAuth Middleware, Daily Dose Changelog, isWorkingDayPure / Batch Holiday Lookup, Root ESLint Flat Config, Jest Test Harness, Keep a Changelog Format, Level-aware Logging (LOG_LEVEL) (+42 more)

### Community 1 - "Codebase Hardening Plans"

Cohesion: 0.07
Nodes (48): Level-Aware Logger, Observability & Reliability Plan, postTeamStandup Idempotency Guard, runScheduledJob Wrapper, Sentry Initialization, StandupResponse (teamId, standupDate) Composite Index, standupService.getActiveMembers (N+1 fix), isWorkingDayPure Pure Core (+40 more)

### Community 2 - "Slash Command Handlers"

Cohesion: 0.12
Nodes (35): deleteHoliday(), listHolidays(), setHoliday(), updateHoliday(), cancelLeave(), cancelMemberLeave(), listLeaves(), listMemberLeaves() (+27 more)

### Community 3 - "Web Landing & Config"

Cohesion: 0.07
Nodes (34): /scripts Route Protection, Semantic Versioning (SemVer), receiveNotifications Flag Semantics, permissionHelper.js, Environment Variables Reference, public/changelog.html Version History Page, public/index.html Landing Page, public/docs.html User Documentation (+26 more)

### Community 4 - "Block Kit & Messaging Helpers"

Cohesion: 0.14
Nodes (27): submitManual(), createActionsBlock(), createButton(), createDividerBlock(), createErrorBlocks(), createFieldsBlock(), createInputBlock(), createLateResponseBlocks() (+19 more)

### Community 5 - "Standup Workflow Handlers"

Cohesion: 0.15
Nodes (23): handleStandupSubmission(), handleStandupUpdateSubmission(), openStandupModal(), postStandup(), previewStandup(), sendFollowupReminders(), sendReminders(), showHistory() (+15 more)

### Community 6 - "Standup Service"

Cohesion: 0.15
Nodes (8): checkTeamMembers(), StandupService, getDayOfWeekIso(), getHolidayDateSet(), getOrgDefaultWorkDays(), isWorkingDay(), isWorkingDayPure(), toIsoDate()

### Community 7 - "Team Service"

Cohesion: 0.1
Nodes (2): TeamService, validateTimeString()

### Community 8 - "User & Org Service"

Cohesion: 0.19
Nodes (1): UserService

### Community 9 - "Scheduler Service"

Cohesion: 0.15
Nodes (5): runScheduledJob(), SchedulerService, escapeForMessage(), parseTimeString(), TimeFormatError

### Community 10 - "Slack Manifest Manager"

Cohesion: 0.25
Nodes (3): parseArgs(), showHelp(), SlackManifestManager

### Community 11 - "Logger Utility"

Cohesion: 0.26
Nodes (12): debug(), emit(), error(), formatTimestamp(), info(), logAction(), logCommand(), logEvent() (+4 more)

### Community 12 - "Project Setup & Tooling"

Cohesion: 0.2
Nodes (14): CONTRIBUTING.md, Root DEPLOYMENT.md, MIT LICENSE File, License/Contributing/Deployment Guide Plan, CI Lint + Test Gate, Root .env.example, Root ESLint Flat Config, husky + lint-staged Pre-Commit Hook (+6 more)

### Community 13 - "Manual Standup Script"

Cohesion: 0.44
Nodes (9): confirmAction(), listTeams(), main(), postAllTeamsStandups(), remindAllTeams(), sendManualStandup(), sendStandupReminders(), sendTroubleshootingMessage() (+1 more)

### Community 14 - "Docs Page Scripts"

Cohesion: 0.33
Nodes (5): fallbackCopyToClipboard(), hideNoResultsMessage(), performSearch(), showNoResultsMessage(), showNotification()

### Community 15 - "Landing Page Scripts"

Cohesion: 0.29
Nodes (2): copyToClipboard(), showNotification()

### Community 16 - "Standup Trigger Script"

Cohesion: 0.52
Nodes (6): confirmAction(), listTeams(), main(), triggerAllTeamsReminders(), triggerFollowupReminder(), triggerStandupReminder()

### Community 17 - "Holiday Command Plans"

Cohesion: 0.29
Nodes (7): stripFormatting Middleware, /dd-holiday-list Command, listHolidays Function, /dd-holiday-delete Command, /dd-holiday-set Command, /dd-holiday-update Command, Holiday Management Commands

### Community 18 - "Brand Identity Assets"

Cohesion: 0.33
Nodes (7): Daily Dose Android Chrome Icon (192x192), Daily Dose Android Chrome Icon (512x512), Daily Dose Apple Touch Icon, Daily Dose Favicon (16x16), Daily Dose Favicon (32x32), Daily Dose Logo (web/public), Daily Dose Logo (root public)

### Community 20 - "Notification Service"

Cohesion: 0.5
Nodes (1): NotificationService

### Community 21 - "Command Registration"

Cohesion: 0.5
Nodes (2): setupCommands(), stripFormatting()

### Community 28 - "BasicAuth Middleware"

Cohesion: 1.0
Nodes (2): createBasicAuth(), timingSafeEqualString()

### Community 61 - "Standup Update Command"

Cohesion: 1.0
Nodes (2): /dd-standup-update Command, standup_update_modal Callback

### Community 62 - "Framework Logos"

Cohesion: 1.0
Nodes (2): React Framework Logo, Vite Framework Logo

## Ambiguous Edges - Review These

- `Admin Notification Feature` → `UserFacingError + sanitizeError` [AMBIGUOUS]
  docs/plans/2026-05-19-security-correctness-hardening.md · relation: conceptually_related_to

## Knowledge Gaps

- **47 isolated node(s):** `SLACK_USER_TOKEN (apps:write scope)`, `slack-app-manifest.json`, `Keep a Changelog Format`, `Root ESLint Flat Config`, `Auto-suspension on Slack User Deactivation` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Team Service`** (21 nodes): `TeamService`, `.createTeam()`, `.findTeamByChannel()`, `.findTeamByName()`, `.getActiveTeamsForScheduling()`, `.getTeamAdmins()`, `.getTeamById()`, `.getTeamMembers()`, `.getUserTeamMembership()`, `.getUserTeams()`, `.isTeamAdmin()`, `.joinTeam()`, `.leaveTeam()`, `.listTeams()`, `.listTeamsForUser()`, `.promoteTeamMember()`, `.setTeamMemberActive()`, `.updateTeam()`, `.updateTeamMemberPreferences()`, `validateTimeString()`, `teamService.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `User & Org Service`** (19 nodes): `UserService`, `.addUserToOrganization()`, `.cancelLeave()`, `.cancelMemberLeave()`, `.canCreateTeam()`, `.fetchSlackUserData()`, `.findOrCreateUser()`, `.findUserByUsernameInOrg()`, `.getActiveLeaves()`, `.getUserOrganization()`, `.getWorkDays()`, `.listMemberLeaves()`, `.promoteOrganizationMember()`, `.setLeave()`, `.setMemberLeave()`, `.setOrganizationMemberActive()`, `.setWorkDays()`, `.suspendUserSystemWide()`, `userService.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Landing Page Scripts`** (8 nodes): `animateCounter()`, `copyToClipboard()`, `scrollToContact()`, `scrollToFeatures()`, `showNotification()`, `typeWriter()`, `validateEmail()`, `main.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Notification Service`** (5 nodes): `NotificationService`, `.notifyAdminsOfStandupSubmission()`, `.notifyTeamAdmins()`, `.sendAdminNotification()`, `notificationService.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Command Registration`** (4 nodes): `setupCommands()`, `stripFormatting()`, `index.js`, `command.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `BasicAuth Middleware`** (3 nodes): `createBasicAuth()`, `timingSafeEqualString()`, `basicAuth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Standup Update Command`** (2 nodes): `/dd-standup-update Command`, `standup_update_modal Callback`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Framework Logos`** (2 nodes): `React Framework Logo`, `Vite Framework Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Admin Notification Feature` and `UserFacingError + sanitizeError`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `createSectionBlock()` connect `Block Kit & Messaging Helpers` to `Slash Command Handlers`, `Manual Standup Script`, `Standup Workflow Handlers`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `createCommandErrorBlocks()` connect `Slash Command Handlers` to `Block Kit & Messaging Helpers`, `Standup Workflow Handlers`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `SchedulerService` connect `Scheduler Service` to `Block Kit & Messaging Helpers`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 29 inferred relationships involving `createCommandErrorBlocks()` (e.g. with `createTeam()` and `joinTeam()`) actually correct?**
  _`createCommandErrorBlocks()` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `createSectionBlock()` (e.g. with `sendStandupReminders()` and `listTeams()`) actually correct?**
  _`createSectionBlock()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 29 inferred relationships involving `ackWithProcessing()` (e.g. with `createTeam()` and `joinTeam()`) actually correct?**
  _`ackWithProcessing()` has 29 INFERRED edges - model-reasoned connections that need verification._
