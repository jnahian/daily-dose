<p align="center">
  <img src="public/logo.png" alt="Daily Dose Logo" width="128" height="128">
</p>

<h1 align="center">Daily Dose Slack Bot</h1>

<p align="center">
Daily Dose is a Slack bot that automates daily standup meetings for teams — it sends reminders, collects responses, and posts formatted standup summaries to team channels.
</p>

<p align="center">
  <a href="https://dd.jnahian.me/docs"><strong>📚 Documentation</strong></a> ·
  <a href="https://dd.jnahian.me/changelog">Changelog</a> ·
  <a href="DEPLOYMENT.md">Deployment</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <a href="https://youtu.be/bQrJqBpSlBU">
    <img src="https://img.youtube.com/vi/bQrJqBpSlBU/maxresdefault.jpg" alt="Daily Dose demo video" width="720">
  </a>
</p>

## ✨ Features

- **Automated standup reminders** — DM reminders at each team's configured time
- **Team management** — create and join teams with custom schedules and timezones
- **Leave & holiday handling** — members on leave or org holidays are skipped automatically
- **Work day configuration** — per-user working days
- **Multi-organization support** — one org per Slack workspace, with an auto-provisioned `#daily-dose-bot` channel
- **Late submission tracking** — late standups are posted as thread replies
- **MCP server** — operate standups from any MCP-compatible AI agent

👉 **Full user guide, command reference, and setup walkthrough live at [dd.jnahian.me/docs](https://dd.jnahian.me/docs).**

## 🚀 Quick Start (users)

1. The bot DMs you a reminder at your team's standup time — click **Submit Standup**, or run `/dd-standup`.
2. Create or join a team with `/dd-team-create` and `/dd-team-join`.
3. Run `/dd-team-list` to see your teams, timings, and timezones.

See the [documentation](https://dd.jnahian.me/docs) for the complete list of `/dd-*` slash commands, leave/holiday management, reminder preferences, and the MCP integration.

## 🛠️ Tech Stack

- **Backend**: Node.js, [Slack Bolt](https://slack.dev/bolt-js/) on Express (HTTP receiver, Socket Mode disabled)
- **Database**: PostgreSQL (Supabase) via [Prisma](https://www.prisma.io/) ORM
- **Scheduling**: node-cron, timezone-aware per team
- **Web frontend**: React 19 + Vite + Tailwind CSS (landing page, docs, admin panel) in `web/`

## 💻 Development

```bash
# Install dependencies
npm install
cd web && npm install && cd ..

# Configure environment (see Configuration in the docs)
cp .env.example .env   # then fill in Slack tokens and database URLs

# Database
npx prisma generate
npx prisma db push          # or run migrations

# Run the bot (port 3000)
npm run dev

# Run the web frontend separately (Vite, hot reload)
cd web && npm run dev
```

Common scripts:

| Command                           | Description                           |
| --------------------------------- | ------------------------------------- |
| `npm run dev`                     | Start the bot with nodemon            |
| `npm start`                       | Start the bot in production           |
| `npm test`                        | Run the Jest test suite               |
| `npm run lint` / `npm run format` | Lint / format backend code            |
| `npm run debug:scheduler`         | Inspect scheduled cron jobs           |
| `npm run team:members`            | Check team member eligibility         |
| `cd web && npm run build`         | Build the web frontend to `web/dist/` |

Architecture, conventions, and the full set of utility/admin scripts are documented in [CLAUDE.md](CLAUDE.md).

## 📦 Project Structure

```
src/
  app.js          # Entry point — Slack Bolt + Express setup
  commands/       # Slash command handlers (/dd-*)
  workflows/      # Interactive components (buttons, modals)
  services/       # Business logic (scheduler, standup, team, user)
  routes/         # Express routers (admin panel API)
  utils/          # Helpers (date, message, permission, blockHelper, ...)
prisma/           # Schema and migrations
web/              # React SPA (landing page, docs, admin panel)
scripts/          # Administrative / operational scripts
docs/             # Internal docs (guidelines, versioning, admin panel)
```

## 🔖 Versioning & Releases

Daily Dose follows [Semantic Versioning](https://semver.org/). Releases are tagged with npm scripts and deployed automatically via GitHub Actions:

```bash
npm run version:patch   # bug fixes      (1.0.0 → 1.0.1)
npm run version:minor   # new features   (1.0.0 → 1.1.0)
npm run version:major   # breaking       (1.0.0 → 2.0.0)
```

See [docs/VERSIONING.md](docs/VERSIONING.md) for the full process and [CHANGELOG.md](CHANGELOG.md) for version history.

## 📄 License

[MIT](LICENSE)

---

For deployment and infrastructure, see [DEPLOYMENT.md](DEPLOYMENT.md). For architecture and development guidance, see [CLAUDE.md](CLAUDE.md).
