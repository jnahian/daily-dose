# Landing Page Redesign — Design Spec

**Date:** 2026-06-12
**Status:** Approved by user (brainstorming session)
**Scope:** Web frontend only (`web/`). No backend changes.

## Goal

Fully redesign the Daily Dose landing page with a premium, product-forward look ("Refined Dark" — Linear/Vercel-style minimalism), while keeping the current landing page intact and viewable at `/v1`.

Drivers (user-stated):

1. **More polished / premium feel** — current page reads generic; new page should look like a serious, modern open-source dev tool.
2. **Show the product more** — lead with realistic Slack UI mockups and a product walkthrough instead of abstract feature cards and a YouTube embed.

## Decisions Made

| Decision        | Choice                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| Versioning      | New design live at `/`; current page preserved at `/v1` (noindex)                                              |
| Style direction | A · Refined Dark (chosen over Friendly Bento and Aurora Bold)                                                  |
| Page structure  | Demo-Deep (chosen over Narrative Flow): scroll timeline is the centerpiece; YouTube video dropped from landing |
| Theming         | Landing page is dark-only; theme toggle hidden on `/` only; all other routes keep light/dark toggle            |
| Primary CTA     | "View on GitHub" (open-source / self-host positioning; no public Slack install)                                |
| Social proof    | Curated static numbers in `web/src/data/landingStats.json` (placeholders shipped, user fills real values)      |
| Scroll behavior | Gentle `whileInView` reveals; **no** pinned scrolljacking                                                      |
| Contact form    | Removed from landing; footer links to existing `/contact` page                                                 |

## Routing & File Layout

- **Old page untouched:** `web/src/components/home/*` is not modified.
- **New page** `web/src/pages/HomeV1.tsx`: renders existing `Hero`, `Features`, `HowItWorks`, `Contact`, `Footer` from `components/home` — i.e., the current `Home.tsx` body. Routed at `/v1` in `App.tsx` (lazy, wrapped in `PageTransition` like other routes). Adds `noindex` robots meta.
- **`web/src/pages/Home.tsx`**: rewritten to render the new landing from `web/src/components/landing/`. Existing SEO meta tags (title, description, OG, Twitter) carried over unchanged.
- **New directory** `web/src/components/landing/`:
  - `LandingHero.tsx`
  - `DayTimeline.tsx` (section id `how-it-works`)
  - `FeaturesBento.tsx` (section id `features`)
  - `StatsStrip.tsx`
  - `HowItWorksSteps.tsx`
  - `Faq.tsx`
  - `FinalCta.tsx`
  - `LandingFooter.tsx`
  - `slack/` — reusable presentational Slack mock primitives: `SlackMessage.tsx`, `SlackButtons.tsx`, `SlackThread.tsx`, `SlackModal.tsx` (pure Tailwind, no live data)
  - `index.ts` barrel
- **Navbar** (`web/src/components/Navbar.tsx`): already route-aware. On `/` it renders forced-dark styling and hides the `ThemeToggle`. All other routes (including `/v1`) unchanged. Home submenu anchors `/#features` and `/#how-it-works` must resolve to the new sections.
- **New data file** `web/src/data/landingStats.json` — array of `{ label, value }` stats; shipped with clearly-marked placeholder values.

## Page Anatomy (top to bottom)

1. **Hero** — centered layout.
   - Badge: "Open source · MIT"
   - H1: "Standups that run themselves."
   - Subhead: async daily standups in Slack — no meetings, no nagging, no missed updates.
   - CTAs: **View on GitHub** (primary: solid light button on dark) + **Documentation** (secondary: outlined), both ≥44px tall.
   - Below: large Slack channel-summary mockup with subtle perspective tilt and soft cyan radial glow.
2. **"A day with Daily Dose"** (`id="walkthrough"`) — vertical timeline, four moments, each a realistic Slack mock revealed on scroll:
   - **9:00 AM** — reminder DM with "Submit standup" / "On leave" buttons (`SlackMessage` + `SlackButtons`)
   - **9:04 AM** — standup submission modal (`SlackModal`)
   - **9:30 AM** — formatted channel summary post (`SlackMessage`)
   - **11:42 AM** — late submission appended as thread reply (`SlackThread`)
3. **Features bento** (`id="features"`) — 6 features, bento grid (2 large + 4 small):
   - Large: Automated reminders & followups; Smart summaries — each with a mini Slack snippet.
   - Small: Timezone-aware; Leave management; Multiple teams; Standup history — Lucide icon + one-liner.
   - **No LordIcon on this page** — Lucide only, consistent stroke width.
4. **Stats strip** — curated numbers from `landingStats.json` (e.g. teams, standups automated, GitHub stars).
5. **How it works** (`id="how-it-works"`) — compact 3 numbered steps: Install & invite → `/dd-team-create` → standups run daily. (Keeps the navbar's `/#how-it-works` anchor pointing at a section actually named "How it works"; the timeline has its own `#walkthrough` id.)
6. **FAQ** — accessible accordion (~6 items): Is it free? · How do I self-host? · What Slack permissions does it need? · Where is my data stored? · Multiple teams/timezones? · What happens when someone's on leave?
7. **Final CTA band** — "Your next standup runs itself." + GitHub/Docs buttons on a gradient-edged dark panel.
8. **Footer** — new minimal dark `LandingFooter` (old `Footer.tsx` remains for `/v1`); links: Docs, Changelog, Contact, Privacy, Terms, GitHub.

## Visual System

- **Palette** (page-scoped explicit Tailwind classes — NOT the themable `bg-primary`/`text-text-*` tokens, so the page is dark regardless of theme):
  - Background `#0A0E16`; surfaces `#0F1626`; borders `slate-800` (1px)
  - Text: headings `slate-50`, body `slate-400`
  - Accent: existing brand cyan `#00cfff`, used sparingly (badge, timeline markers, hovers)
  - One cyan→blue gradient reserved for the H1 highlight and final CTA band
- **Typography**: Inter (already loaded). Headings 600–700 weight, tight tracking, display sizes up to `text-6xl`/`text-7xl`; body 16–18px, line-height ~1.6.
- **Motion**: Framer Motion `whileInView` (`viewport={{ once: true }}`) reveals only; 150–300ms, ease-out, 30–50ms stagger for grids/timeline; `useReducedMotion` disables translation (opacity-only or none). Animate `transform`/`opacity` only — no layout-shifting animations.
- **Accessibility**:
  - Contrast ≥4.5:1 for all text (slate-400 on `#0A0E16` ≈ 7:1)
  - Visible focus rings on all interactive elements
  - Sequential heading hierarchy (one `h1`, then `h2` per section)
  - FAQ items are `<button>`s with `aria-expanded`/`aria-controls`
  - Touch targets ≥44px; `cursor-pointer` on clickables
  - Slack mocks are decorative: `aria-hidden` where text duplicates adjacent copy, or given descriptive labels where standalone

## Error Handling / Edge Cases

- `landingStats.json` is imported statically (build-time) — no fetch, no loading/error states.
- Slack mocks are static markup — no external assets beyond fonts/icons already in the bundle (LordIcon CDN not used on the new page).
- `/v1` must render pixel-identical to today's `/` (only the route changes).
- Reduced-motion users see content immediately (no opacity-0 stuck states).

## Verification

1. `cd web && npm run build && npm run lint && npm run format:check`
2. Visual pass (Playwright) at 375px, 768px, 1440px — no horizontal scroll at 375px.
3. `prefers-reduced-motion` check: content visible without animation.
4. `/v1` renders the old landing page; theme toggle works there.
5. Navbar anchors `/#features`, `/#how-it-works` scroll to the new sections.
6. Theme toggle hidden on `/`, present on other routes.

## Bookkeeping

- `CHANGELOG.md`: technical entry (new landing components, `/v1` route, navbar changes).
- `web/src/data/changelog.json`: user-facing entry ("Brand-new landing page with a live product walkthrough; the previous design remains available at /v1").
- Out of scope: backend, contact form internals, Docs/Changelog page restyling, old `components/home/*` code.
