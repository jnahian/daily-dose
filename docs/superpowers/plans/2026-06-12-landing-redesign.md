# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing page at `/` with a new "Refined Dark" product-forward design while preserving the current page unchanged at `/v1`.

**Architecture:** New presentational components live in `web/src/components/landing/` (with reusable Slack-mock primitives in `landing/slack/`). `pages/Home.tsx` is rewritten to assemble them; the old page body moves to `pages/HomeV1.tsx` routed at `/v1`. The shared Navbar gets a forced-dark variant on `/` only. All new styling uses explicit dark classes (not theme tokens) so the landing is dark regardless of the toggle.

**Tech Stack:** React 19 + TypeScript, Vite 6, Tailwind CSS v4, Framer Motion 12, lucide-react, react-router 7 (library mode).

**Spec:** `docs/superpowers/specs/2026-06-12-landing-redesign-design.md`

**Testing note:** `web/` has no unit-test runner (Jest covers only the backend `test/` tree). Verification per task is `cd web && npx tsc -b && npm run lint` (fast type+lint gate), with `npm run build` and a browser pass at the end. Do NOT add a test framework — out of scope.

**Conventions that apply:**

- Old code is untouched: do not edit anything in `web/src/components/home/`.
- This is a website change, not an admin-panel change, so it DOES get changelog entries.
- Commit after every task. Run commits from the repo root (husky/lint-staged will run prettier).

---

### Task 1: Preserve the current page at `/v1`

**Files:**

- Create: `web/src/pages/HomeV1.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create `web/src/pages/HomeV1.tsx`**

This is the current `Home.tsx` body plus a `noindex` robots meta injected on mount (SPA — there's no SSR, so the tag is added via effect; the `meta()` export convention is kept for consistency with other pages even though nothing consumes it yet).

```tsx
import { useEffect } from "react";
import {
  Hero,
  Features,
  HowItWorks,
  Contact,
  Footer,
} from "../components/home";

export const meta = () => {
  return [
    { title: "Daily Dose - Classic Landing Page" },
    { name: "robots", content: "noindex" },
  ];
};

const HomeV1 = () => {
  useEffect(() => {
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex";
    document.head.appendChild(tag);
    return () => {
      document.head.removeChild(tag);
    };
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary selection:bg-brand-cyan/30 transition-colors duration-300">
      <Hero />
      <Features />
      <HowItWorks />
      <Contact />
      <Footer />
    </div>
  );
};

export default HomeV1;
```

- [ ] **Step 2: Add the `/v1` route in `web/src/App.tsx`**

After the existing lazy imports (below `const Home = lazy(...)`) add:

```tsx
const HomeV1 = lazy(() => import("./pages/HomeV1"));
```

Inside `<Routes>`, directly after the `/` route's closing `/>`, add:

```tsx
<Route
  path="/v1"
  element={
    <PageTransition>
      <HomeV1 />
    </PageTransition>
  }
/>
```

- [ ] **Step 3: Verify**

Run: `cd web && npx tsc -b && npm run lint`
Expected: no errors.

Run: `cd web && npm run dev` then open `http://localhost:5173/v1`
Expected: identical copy of today's homepage (hero video, feature cards, contact form). Theme toggle works on it. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/HomeV1.tsx web/src/App.tsx
git commit -m "Preserve current landing page at /v1"
```

---

### Task 2: Motion helper + Slack mock primitives

**Files:**

- Create: `web/src/components/landing/motion.ts`
- Create: `web/src/components/landing/slack/SlackSurface.tsx`
- Create: `web/src/components/landing/slack/SlackMessage.tsx`
- Create: `web/src/components/landing/slack/SlackButtons.tsx`
- Create: `web/src/components/landing/slack/SlackThread.tsx`
- Create: `web/src/components/landing/slack/SlackModal.tsx`
- Create: `web/src/components/landing/slack/index.ts`

The Slack mocks deliberately use real Slack-dark-mode colors (`#1a1d21` pane, `#007a5a` green button, `#1d9bd1` link blue) so they read as authentic screenshots, framed inside the page's own palette. They are static markup — no live data, no LordIcon, no external assets beyond `/logo.png` already in `web/public/`.

- [ ] **Step 1: Create `web/src/components/landing/motion.ts`**

Single reveal helper used by every section — keeps duration/easing consistent and centralizes reduced-motion handling (spec: transform/opacity only, 150–300ms, ease-out, `once: true`).

```ts
import { useReducedMotion } from "framer-motion";

/**
 * Spread onto a motion.* element for a scroll-triggered fade-up reveal.
 * Respects prefers-reduced-motion (content renders immediately, no movement).
 */
export const useReveal = (delay = 0) => {
  const reduce = useReducedMotion();
  return {
    initial: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.3, delay, ease: "easeOut" as const },
  };
};
```

- [ ] **Step 2: Create `web/src/components/landing/slack/SlackSurface.tsx`**

```tsx
interface SlackSurfaceProps {
  header?: string;
  children: React.ReactNode;
  className?: string;
}

export const SlackSurface = ({
  header,
  children,
  className = "",
}: SlackSurfaceProps) => (
  <div
    className={`overflow-hidden rounded-xl border border-slate-800 bg-[#1a1d21] text-left shadow-2xl ${className}`}
  >
    {header && (
      <div className="border-b border-[#35373b] px-4 py-2.5 text-[13px] font-bold text-slate-200">
        {header}
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);
```

- [ ] **Step 3: Create `web/src/components/landing/slack/SlackMessage.tsx`**

```tsx
interface SlackMessageProps {
  name?: string;
  time: string;
  isApp?: boolean;
  /** Render a colored-initials avatar (human) instead of the bot logo */
  initials?: string;
  children: React.ReactNode;
}

export const SlackMessage = ({
  name = "Daily Dose",
  time,
  isApp = true,
  initials,
  children,
}: SlackMessageProps) => (
  <div className="flex gap-2.5">
    {initials ? (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-600 text-[12px] font-bold text-white">
        {initials}
      </div>
    ) : (
      <img src="/logo.png" alt="" className="h-9 w-9 shrink-0 rounded-md" />
    )}
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span className="text-[13.5px] font-bold text-slate-100">{name}</span>
        {isApp && (
          <span className="rounded-sm bg-[#35373b] px-1 py-px text-[9px] font-semibold tracking-wide text-slate-400 uppercase">
            App
          </span>
        )}
        <span className="text-[11px] text-slate-500">{time}</span>
      </div>
      <div className="mt-1 space-y-2 text-[13px] leading-relaxed text-slate-300">
        {children}
      </div>
    </div>
  </div>
);
```

- [ ] **Step 4: Create `web/src/components/landing/slack/SlackButtons.tsx`**

Non-interactive by design (decorative mock) — rendered as `span`s, not `button`s, so they aren't keyboard-focusable dead ends.

```tsx
interface SlackButtonsProps {
  buttons: { label: string; primary?: boolean }[];
}

export const SlackButtons = ({ buttons }: SlackButtonsProps) => (
  <div className="flex flex-wrap gap-2">
    {buttons.map((b) => (
      <span
        key={b.label}
        className={
          b.primary
            ? "rounded-md bg-[#007a5a] px-3 py-1.5 text-[12px] font-bold text-white"
            : "rounded-md border border-[#4a4d52] px-3 py-1.5 text-[12px] font-bold text-slate-200"
        }
      >
        {b.label}
      </span>
    ))}
  </div>
);
```

- [ ] **Step 5: Create `web/src/components/landing/slack/SlackThread.tsx`**

```tsx
interface SlackThreadProps {
  replyCount: number;
  children: React.ReactNode;
}

export const SlackThread = ({ replyCount, children }: SlackThreadProps) => (
  <div className="mt-2 border-l-2 border-[#35373b] pl-3">
    <div className="mb-2 text-[11px] font-semibold text-[#1d9bd1]">
      {replyCount} {replyCount === 1 ? "reply" : "replies"}
    </div>
    {children}
  </div>
);
```

- [ ] **Step 6: Create `web/src/components/landing/slack/SlackModal.tsx`**

```tsx
import { X } from "lucide-react";

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="mb-1 text-[12px] font-bold text-slate-200">{label}</div>
    <div className="rounded-md border border-[#4a4d52] bg-[#222529] px-3 py-2 text-[12.5px] text-slate-300">
      {value}
    </div>
  </div>
);

export const SlackModal = () => (
  <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#1a1d21] text-left shadow-2xl">
    <div className="flex items-center justify-between border-b border-[#35373b] px-4 py-3">
      <span className="text-[15px] font-bold text-slate-100">
        Daily Standup
      </span>
      <X size={16} className="text-slate-500" />
    </div>
    <div className="space-y-3 p-4">
      <Field
        label="What did you do yesterday?"
        value="Shipped the auth flow, reviewed PR #42"
      />
      <Field
        label="What will you do today?"
        value="Start on the billing webhooks"
      />
      <Field label="Any blockers?" value="Waiting on staging credentials" />
    </div>
    <div className="flex justify-end gap-2 border-t border-[#35373b] px-4 py-3">
      <span className="rounded-md border border-[#4a4d52] px-3 py-1.5 text-[12px] font-bold text-slate-200">
        Cancel
      </span>
      <span className="rounded-md bg-[#007a5a] px-3 py-1.5 text-[12px] font-bold text-white">
        Submit
      </span>
    </div>
  </div>
);
```

- [ ] **Step 7: Create `web/src/components/landing/slack/index.ts`**

```ts
export { SlackSurface } from "./SlackSurface";
export { SlackMessage } from "./SlackMessage";
export { SlackButtons } from "./SlackButtons";
export { SlackThread } from "./SlackThread";
export { SlackModal } from "./SlackModal";
```

- [ ] **Step 8: Verify**

Run: `cd web && npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add web/src/components/landing/
git commit -m "Add landing motion helper and Slack mock primitives"
```

---

### Task 3: Shared CTA buttons + LandingHero

**Files:**

- Create: `web/src/components/landing/CtaButtons.tsx`
- Create: `web/src/components/landing/LandingHero.tsx`

- [ ] **Step 1: Create `web/src/components/landing/CtaButtons.tsx`**

Used in both the hero and the final CTA band (DRY). Primary = solid light on dark; secondary = outlined. Both ≥44px tall.

```tsx
import { Link } from "react-router";
import { ArrowRight, Github } from "lucide-react";

export const CtaButtons = () => (
  <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
    <a
      href="https://github.com/jnahian/daily-dose"
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-6 py-3 text-[15px] font-semibold text-[#0A0E16] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan"
    >
      <Github size={18} />
      View on GitHub
    </a>
    <Link
      to="/docs"
      className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-slate-800 px-6 py-3 text-[15px] font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-cyan"
    >
      Documentation
      <ArrowRight size={16} />
    </Link>
  </div>
);
```

- [ ] **Step 2: Create `web/src/components/landing/LandingHero.tsx`**

Centered hero; below it a Slack channel-summary mock with a subtle perspective tilt and cyan radial glow. The mock is `aria-hidden` (decorative — its content restates the headline's promise).

```tsx
import { motion } from "framer-motion";
import { useReveal } from "./motion";
import { CtaButtons } from "./CtaButtons";
import { SlackSurface, SlackMessage } from "./slack";

export const LandingHero = () => (
  <header className="relative overflow-hidden px-4 pt-32 pb-20 sm:px-6 sm:pt-40 lg:px-8">
    <div className="mx-auto max-w-4xl text-center">
      <motion.div {...useReveal()}>
        <span className="inline-block rounded-full border border-slate-800 bg-[#0F1626] px-3 py-1 text-[13px] font-medium text-brand-cyan">
          Open source · MIT licensed
        </span>
        <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-50 sm:text-7xl">
          Standups that{" "}
          <span className="bg-gradient-to-r from-brand-cyan to-brand-blue bg-clip-text text-transparent">
            run themselves.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-400 sm:text-xl">
          Daily Dose runs your team&apos;s daily standup inside Slack — async
          reminders, two-minute updates, one clean summary. No meetings, no
          nagging, no missed updates.
        </p>
        <div className="mt-10">
          <CtaButtons />
        </div>
      </motion.div>

      <motion.div
        {...useReveal(0.15)}
        aria-hidden="true"
        className="relative mx-auto mt-16 max-w-2xl"
      >
        <div className="absolute inset-0 -z-10 mx-auto h-3/4 w-3/4 rounded-full bg-brand-cyan/10 blur-[100px]" />
        <div className="[transform:perspective(1200px)_rotateX(5deg)]">
          <SlackSurface header="#team-standup">
            <SlackMessage time="9:30 AM">
              <p className="font-bold text-slate-100">
                ☀️ Daily Standup — Thursday, Jun 12
              </p>
              <div className="border-l-2 border-brand-cyan/60 pl-3">
                <p className="font-bold text-slate-100">Sarah</p>
                <p>
                  <span className="text-slate-500">Yesterday:</span> Shipped the
                  auth flow · <span className="text-slate-500">Today:</span>{" "}
                  Billing webhooks
                </p>
              </div>
              <div className="border-l-2 border-brand-cyan/60 pl-3">
                <p className="font-bold text-slate-100">Dev</p>
                <p>
                  <span className="text-slate-500">Today:</span> API rate
                  limiter ·{" "}
                  <span className="text-red-400">
                    Blocked: staging credentials
                  </span>
                </p>
              </div>
              <p className="text-[12px] text-slate-500">
                ✅ 6 of 7 submitted · 🏖️ 1 on leave
              </p>
            </SlackMessage>
          </SlackSurface>
        </div>
      </motion.div>
    </div>
  </header>
);
```

- [ ] **Step 3: Verify**

Run: `cd web && npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/landing/CtaButtons.tsx web/src/components/landing/LandingHero.tsx
git commit -m "Add landing hero and shared CTA buttons"
```

---

### Task 4: "A day with Daily Dose" walkthrough timeline

**Files:**

- Create: `web/src/components/landing/DayTimeline.tsx`

- [ ] **Step 1: Create `web/src/components/landing/DayTimeline.tsx`**

Section id is `walkthrough` (NOT `how-it-works` — that id belongs to the steps section in Task 6). Four moments on a vertical line, each revealed on scroll with a 50ms stagger feel via per-item delay.

```tsx
import { motion } from "framer-motion";
import { useReveal } from "./motion";
import {
  SlackSurface,
  SlackMessage,
  SlackButtons,
  SlackThread,
  SlackModal,
} from "./slack";

interface MomentProps {
  time: string;
  title: string;
  description: string;
  delay: number;
  children: React.ReactNode;
}

const Moment = ({ time, title, description, delay, children }: MomentProps) => {
  const reveal = useReveal(delay);
  return (
    <motion.li {...reveal} className="relative pb-16 pl-8 last:pb-0 sm:pl-12">
      <span
        aria-hidden="true"
        className="absolute top-1 left-[-5px] h-2.5 w-2.5 rounded-full bg-brand-cyan shadow-[0_0_12px_rgba(0,207,255,0.6)]"
      />
      <p className="font-mono text-[13px] font-semibold text-brand-cyan">
        {time}
      </p>
      <h3 className="mt-1 text-xl font-semibold text-slate-50">{title}</h3>
      <p className="mt-1 mb-5 max-w-md text-[15px] text-slate-400">
        {description}
      </p>
      <div aria-hidden="true" className="max-w-xl">
        {children}
      </div>
    </motion.li>
  );
};

export const DayTimeline = () => (
  <section id="walkthrough" className="px-4 py-24 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-3xl">
      <motion.div {...useReveal()} className="mb-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          A day with Daily Dose
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">
          From morning reminder to posted summary — here&apos;s the entire
          standup, with zero meetings.
        </p>
      </motion.div>

      <ul className="relative border-l border-slate-800">
        <Moment
          time="9:00 AM"
          title="The reminder finds you"
          description="Daily Dose DMs every active member at the team's standup time — skipping weekends, holidays, and anyone on leave."
          delay={0}
        >
          <SlackSurface header="Daily Dose">
            <SlackMessage time="9:00 AM">
              <p>
                ⏰ Good morning! Time for your daily standup for{" "}
                <span className="font-bold text-slate-100">Platform Team</span>.
              </p>
              <SlackButtons
                buttons={[
                  { label: "Submit standup", primary: true },
                  { label: "On leave" },
                ]}
              />
            </SlackMessage>
          </SlackSurface>
        </Moment>

        <Moment
          time="9:04 AM"
          title="Two minutes in a modal"
          description="One click opens a simple form: yesterday, today, blockers. Type, submit, done — no meeting required."
          delay={0.05}
        >
          <SlackModal />
        </Moment>

        <Moment
          time="9:30 AM"
          title="The summary posts itself"
          description="At posting time, everyone's updates land in the team channel as one clean, formatted summary."
          delay={0.05}
        >
          <SlackSurface header="#team-standup">
            <SlackMessage time="9:30 AM">
              <p className="font-bold text-slate-100">
                ☀️ Daily Standup — Thursday, Jun 12
              </p>
              <div className="border-l-2 border-brand-cyan/60 pl-3">
                <p className="font-bold text-slate-100">Sarah</p>
                <p>
                  <span className="text-slate-500">Yesterday:</span> Shipped the
                  auth flow · <span className="text-slate-500">Today:</span>{" "}
                  Billing webhooks
                </p>
              </div>
              <div className="border-l-2 border-brand-cyan/60 pl-3">
                <p className="font-bold text-slate-100">Dev</p>
                <p>
                  <span className="text-slate-500">Today:</span> API rate
                  limiter ·{" "}
                  <span className="text-red-400">
                    Blocked: staging credentials
                  </span>
                </p>
              </div>
              <p className="text-[12px] text-slate-500">
                ⏳ Not yet responded: Maya
              </p>
            </SlackMessage>
          </SlackSurface>
        </Moment>

        <Moment
          time="11:42 AM"
          title="Late updates thread in"
          description="Submitted after posting time? No problem — late responses attach to the summary as thread replies."
          delay={0.05}
        >
          <SlackSurface header="#team-standup">
            <SlackMessage time="9:30 AM">
              <p className="font-bold text-slate-100">
                ☀️ Daily Standup — Thursday, Jun 12
              </p>
              <SlackThread replyCount={1}>
                <SlackMessage
                  name="Maya"
                  time="11:42 AM"
                  isApp={false}
                  initials="M"
                >
                  <p>
                    <span className="text-slate-500">Yesterday:</span> Bug
                    triage · <span className="text-slate-500">Today:</span>{" "}
                    Release notes
                  </p>
                </SlackMessage>
              </SlackThread>
            </SlackMessage>
          </SlackSurface>
        </Moment>
      </ul>
    </div>
  </section>
);
```

- [ ] **Step 2: Verify**

Run: `cd web && npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/landing/DayTimeline.tsx
git commit -m "Add day-with-Daily-Dose walkthrough timeline"
```

---

### Task 5: Features bento grid

**Files:**

- Create: `web/src/components/landing/FeaturesBento.tsx`

- [ ] **Step 1: Create `web/src/components/landing/FeaturesBento.tsx`**

Section id `features` (navbar anchor target). 6-column grid: rows of 4+2 / 2+4 / 3+3. Lucide icons only — no LordIcon on this page.

```tsx
import { motion } from "framer-motion";
import {
  Bell,
  CalendarOff,
  Globe,
  History,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useReveal } from "./motion";
import { SlackSurface, SlackMessage, SlackButtons } from "./slack";

interface CellProps {
  icon: LucideIcon;
  title: string;
  description: string;
  span: string;
  delay: number;
  children?: React.ReactNode;
}

const Cell = ({
  icon: Icon,
  title,
  description,
  span,
  delay,
  children,
}: CellProps) => (
  <motion.div
    {...useReveal(delay)}
    className={`rounded-2xl border border-slate-800 bg-[#0F1626] p-6 transition-colors hover:border-slate-700 ${span}`}
  >
    <Icon size={20} className="text-brand-cyan" aria-hidden="true" />
    <h3 className="mt-3 text-lg font-semibold text-slate-50">{title}</h3>
    <p className="mt-1.5 text-[15px] leading-relaxed text-slate-400">
      {description}
    </p>
    {children && (
      <div aria-hidden="true" className="mt-5">
        {children}
      </div>
    )}
  </motion.div>
);

export const FeaturesBento = () => (
  <section id="features" className="px-4 py-24 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <motion.div {...useReveal()} className="mb-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          Everything a standup needs.
          <br />
          Nothing it doesn&apos;t.
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <Cell
          icon={Bell}
          title="Automated reminders & followups"
          description="Reminders go out at your team's standup time, and stragglers get a gentle followup — you never have to chase anyone again."
          span="md:col-span-4"
          delay={0}
        >
          <SlackSurface>
            <SlackMessage time="9:45 AM">
              <p>
                👋 Friendly nudge — the{" "}
                <span className="font-bold text-slate-100">Platform Team</span>{" "}
                standup posts in 15 minutes.
              </p>
              <SlackButtons
                buttons={[{ label: "Submit standup", primary: true }]}
              />
            </SlackMessage>
          </SlackSurface>
        </Cell>
        <Cell
          icon={Globe}
          title="Timezone-aware"
          description="Each team gets its own schedule — 9:30 AM means 9:30 AM, wherever they are."
          span="md:col-span-2"
          delay={0.05}
        />
        <Cell
          icon={CalendarOff}
          title="Leave management"
          description="Mark yourself away with /dd-leave. No reminders while you recharge, and the summary notes it."
          span="md:col-span-2"
          delay={0}
        />
        <Cell
          icon={Sparkles}
          title="Smart summaries"
          description="Everyone's updates compiled into one clean, formatted post — blockers highlighted, non-responders listed, leave respected."
          span="md:col-span-4"
          delay={0.05}
        >
          <SlackSurface>
            <SlackMessage time="9:30 AM">
              <p className="font-bold text-slate-100">
                ☀️ Daily Standup — Thursday, Jun 12
              </p>
              <p className="text-[12px] text-slate-500">
                ✅ 6 of 7 submitted · 🏖️ 1 on leave · 🚧 1 blocker raised
              </p>
            </SlackMessage>
          </SlackSurface>
        </Cell>
        <Cell
          icon={Users}
          title="Multiple teams"
          description="Engineering, design, marketing — separate channels, schedules, and members under one workspace."
          span="md:col-span-3"
          delay={0}
        />
        <Cell
          icon={History}
          title="Standup history"
          description="Every update is saved. Look back at any day with /dd-standup-history."
          span="md:col-span-3"
          delay={0.05}
        />
      </div>
    </div>
  </section>
);
```

- [ ] **Step 2: Verify**

Run: `cd web && npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/landing/FeaturesBento.tsx
git commit -m "Add features bento grid"
```

---

### Task 6: Stats strip + How-it-works steps

**Files:**

- Create: `web/src/data/landingStats.json`
- Create: `web/src/components/landing/StatsStrip.tsx`
- Create: `web/src/components/landing/HowItWorksSteps.tsx`

- [ ] **Step 1: Create `web/src/data/landingStats.json`**

Curated static numbers (user decision — no API). The values below are conservative placeholders; **flag to the user at final review that they should set real numbers** (one-line edits here).

```json
{
  "_note": "Curated manually — update values periodically. Shown on the landing page stats strip.",
  "stats": [
    { "value": "10+", "label": "Teams running standups" },
    { "value": "5,000+", "label": "Standups automated" },
    { "value": "100%", "label": "Open source, MIT licensed" }
  ]
}
```

- [ ] **Step 2: Create `web/src/components/landing/StatsStrip.tsx`**

```tsx
import { motion } from "framer-motion";
import { useReveal } from "./motion";
import statsData from "../../data/landingStats.json";

export const StatsStrip = () => (
  <section className="px-4 py-16 sm:px-6 lg:px-8">
    <motion.div
      {...useReveal()}
      className="mx-auto grid max-w-4xl grid-cols-1 divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-[#0F1626] sm:grid-cols-3 sm:divide-x sm:divide-y-0"
    >
      {statsData.stats.map((s) => (
        <div key={s.label} className="px-6 py-8 text-center">
          <p className="text-4xl font-bold tracking-tight text-slate-50">
            {s.value}
          </p>
          <p className="mt-2 text-[14px] text-slate-400">{s.label}</p>
        </div>
      ))}
    </motion.div>
  </section>
);
```

- [ ] **Step 3: Create `web/src/components/landing/HowItWorksSteps.tsx`**

Section id `how-it-works` — this is where the navbar's `/#how-it-works` anchor lands.

```tsx
import { motion } from "framer-motion";
import { useReveal } from "./motion";

const steps = [
  {
    number: "01",
    title: "Install & invite",
    description:
      "Clone the repo, deploy with your Slack app credentials, and invite the bot to your team's channel.",
    chip: "git clone jnahian/daily-dose",
  },
  {
    number: "02",
    title: "Create your team",
    description:
      "One command sets the standup time, posting time, and timezone for the channel.",
    chip: "/dd-team-create",
  },
  {
    number: "03",
    title: "Standups run daily",
    description:
      "Reminders go out, updates are collected, and the summary posts — every workday, automatically.",
    chip: "☀️ posted to #team-standup",
  },
];

// Extracted component so useReveal (a hook) is never called inside .map()
const StepCard = ({
  step,
  delay,
}: {
  step: (typeof steps)[number];
  delay: number;
}) => (
  <motion.div
    {...useReveal(delay)}
    className="rounded-2xl border border-slate-800 bg-[#0F1626] p-6"
  >
    <p className="font-mono text-[13px] font-semibold text-brand-cyan">
      {step.number}
    </p>
    <h3 className="mt-3 text-lg font-semibold text-slate-50">{step.title}</h3>
    <p className="mt-1.5 text-[15px] leading-relaxed text-slate-400">
      {step.description}
    </p>
    <code className="mt-5 inline-block rounded-md border border-slate-800 bg-[#0A0E16] px-3 py-1.5 font-mono text-[12.5px] text-slate-300">
      {step.chip}
    </code>
  </motion.div>
);

export const HowItWorksSteps = () => (
  <section id="how-it-works" className="px-4 py-24 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <motion.div {...useReveal()} className="mb-16 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          Up and running in minutes
        </h2>
      </motion.div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((step, i) => (
          <StepCard key={step.number} step={step} delay={i * 0.05} />
        ))}
      </div>
    </div>
  </section>
);
```

- [ ] **Step 4: Verify**

Run: `cd web && npx tsc -b && npm run lint`
Expected: no errors. (If `tsc` complains about the JSON import, check `resolveJsonModule` — the existing `changelog.json` import in the Changelog page uses the same mechanism, so this should already work.)

- [ ] **Step 5: Commit**

```bash
git add web/src/data/landingStats.json web/src/components/landing/StatsStrip.tsx web/src/components/landing/HowItWorksSteps.tsx
git commit -m "Add stats strip and how-it-works steps"
```

---

### Task 7: FAQ accordion

**Files:**

- Create: `web/src/components/landing/Faq.tsx`

- [ ] **Step 1: Create `web/src/components/landing/Faq.tsx`**

Accessible accordion: real `<button>`s with `aria-expanded`/`aria-controls`, one item open at a time, 150ms opacity fade (no height animation — avoids layout-shift jank).

```tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useReveal } from "./motion";

const items = [
  {
    q: "Is Daily Dose free?",
    a: "Yes. Daily Dose is open source under the MIT license. Self-host it on your own infrastructure at no cost.",
  },
  {
    q: "How do I self-host it?",
    a: "You need Node.js, a PostgreSQL database, and a Slack app. Clone the repository, set your environment variables, and deploy — the repo includes a step-by-step deployment guide and a committed Slack app manifest.",
  },
  {
    q: "What Slack permissions does it need?",
    a: "Only what it uses: sending DMs for reminders, posting to channels it's invited to, and reading team member lists. The full scope list lives in the app manifest in the repository, so you can audit it before installing.",
  },
  {
    q: "Where is my data stored?",
    a: "In your own PostgreSQL database. When you self-host, standup responses, teams, and schedules never leave your infrastructure.",
  },
  {
    q: "Can different teams have different schedules?",
    a: "Yes. Every team sets its own standup time, posting time, and timezone — a team in Dhaka and a team in Berlin each get reminders at their own 9:30 AM.",
  },
  {
    q: "What happens when someone is on leave?",
    a: "They mark it with /dd-leave (or the reminder's On-leave button). Daily Dose skips their reminders for those dates and notes the leave in the posted summary instead of listing them as missing.",
  },
];

export const Faq = () => {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <motion.div {...useReveal()} className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            Frequently asked questions
          </h2>
        </motion.div>
        <motion.div
          {...useReveal(0.05)}
          className="divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-[#0F1626]"
        >
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  className="flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left text-[16px] font-semibold text-slate-50 transition-colors hover:text-brand-cyan focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-cyan"
                >
                  {item.q}
                  <ChevronDown
                    size={18}
                    aria-hidden="true"
                    className={`shrink-0 text-slate-500 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-panel-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <p className="px-6 pb-5 text-[15px] leading-relaxed text-slate-400">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};
```

- [ ] **Step 2: Verify**

Run: `cd web && npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/landing/Faq.tsx
git commit -m "Add FAQ accordion"
```

---

### Task 8: Final CTA band + landing footer + barrel

**Files:**

- Create: `web/src/components/landing/FinalCta.tsx`
- Create: `web/src/components/landing/LandingFooter.tsx`
- Create: `web/src/components/landing/index.ts`

- [ ] **Step 1: Create `web/src/components/landing/FinalCta.tsx`**

Gradient-edged panel: 1px gradient border via padded gradient wrapper (the one allowed gradient use besides the H1).

```tsx
import { motion } from "framer-motion";
import { useReveal } from "./motion";
import { CtaButtons } from "./CtaButtons";

export const FinalCta = () => (
  <section className="px-4 py-24 sm:px-6 lg:px-8">
    <motion.div
      {...useReveal()}
      className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-r from-brand-cyan/40 via-slate-800 to-brand-blue/40 p-px"
    >
      <div className="rounded-[calc(1.5rem-1px)] bg-[#0A0E16] px-6 py-16 text-center sm:px-12">
        <h2 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          Your next standup runs itself.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-slate-400">
          Free, open source, and live in your Slack workspace in minutes.
        </p>
        <div className="mt-8">
          <CtaButtons />
        </div>
      </div>
    </motion.div>
  </section>
);
```

- [ ] **Step 2: Create `web/src/components/landing/LandingFooter.tsx`**

```tsx
import { Link } from "react-router";
import { Github } from "lucide-react";

const links = [
  { label: "Documentation", to: "/docs" },
  { label: "Changelog", to: "/changelog" },
  { label: "Contact", to: "/contact" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
];

export const LandingFooter = () => (
  <footer className="border-t border-slate-800 px-4 py-12 sm:px-6 lg:px-8">
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="" className="h-7 w-7 rounded-md" />
        <span className="font-bold text-slate-50">Daily Dose</span>
      </div>
      <nav
        aria-label="Footer"
        className="flex flex-wrap justify-center gap-x-6 gap-y-2"
      >
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="text-[14px] text-slate-400 transition-colors hover:text-slate-50"
          >
            {l.label}
          </Link>
        ))}
        <a
          href="https://github.com/jnahian/daily-dose"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub repository"
          className="text-slate-400 transition-colors hover:text-slate-50"
        >
          <Github size={18} />
        </a>
      </nav>
      <p className="text-[13px] text-slate-500">
        © 2026 Daily Dose · MIT License
      </p>
    </div>
  </footer>
);
```

- [ ] **Step 3: Create `web/src/components/landing/index.ts`**

```ts
export { LandingHero } from "./LandingHero";
export { DayTimeline } from "./DayTimeline";
export { FeaturesBento } from "./FeaturesBento";
export { StatsStrip } from "./StatsStrip";
export { HowItWorksSteps } from "./HowItWorksSteps";
export { Faq } from "./Faq";
export { FinalCta } from "./FinalCta";
export { LandingFooter } from "./LandingFooter";
```

- [ ] **Step 4: Verify**

Run: `cd web && npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/landing/
git commit -m "Add final CTA band, landing footer, and barrel export"
```

---

### Task 9: Assemble the new Home page

**Files:**

- Modify: `web/src/pages/Home.tsx`

- [ ] **Step 1: Rewrite `web/src/pages/Home.tsx`**

Keep the existing `meta()` export **byte-for-byte unchanged** (lines 9–48 of the current file). Replace only the imports and the component body:

```tsx
import {
  LandingHero,
  DayTimeline,
  FeaturesBento,
  StatsStrip,
  HowItWorksSteps,
  Faq,
  FinalCta,
  LandingFooter,
} from "../components/landing";

export const meta = () => {
  // ... keep the existing meta() body exactly as it is today ...
};

const Home = () => {
  return (
    <div className="min-h-screen bg-[#0A0E16] text-slate-50 selection:bg-brand-cyan/30">
      <LandingHero />
      <DayTimeline />
      <FeaturesBento />
      <StatsStrip />
      <HowItWorksSteps />
      <Faq />
      <FinalCta />
      <LandingFooter />
    </div>
  );
};

export default Home;
```

(The `// ... keep ...` comment above is plan shorthand for "do not touch that block" — the actual file must contain the full existing meta array, not a comment.)

- [ ] **Step 2: Verify in browser**

Run: `cd web && npx tsc -b && npm run lint` — expected: no errors.

Run: `cd web && npm run dev`, open `http://localhost:5173/`
Expected: full new dark page renders top to bottom — hero with tilted Slack summary, timeline, bento, stats, steps, FAQ (first item open, others toggle), CTA band, footer. `http://localhost:5173/v1` still shows the old page. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Home.tsx
git commit -m "Assemble new Refined Dark landing page at /"
```

---

### Task 10: Navbar — forced dark on `/`, hide theme toggle

**Files:**

- Modify: `web/src/components/Navbar.tsx`

The landing is dark-only; the themable navbar would flash white over it in light mode. On `/` only: dark surfaces, dark text colors, no ThemeToggle. Every other route (including `/v1`) keeps current behavior. Four edits:

- [ ] **Step 1: Add the route flag**

After `const currentPath = location.pathname;` add:

```tsx
const isLanding = currentPath === "/";
```

- [ ] **Step 2: Make surface + text classes conditional**

Replace the `<nav>` opening tag's className:

```tsx
<nav
  className={`fixed w-full z-50 backdrop-blur-md border-b transition-colors duration-300 ${
    isLanding
      ? "bg-[#0A0E16]/80 border-slate-800"
      : "bg-bg-primary/80 border-border-default"
  }`}
>
```

Replace the logo text span's className:

```tsx
<span
  className={`font-bold text-xl tracking-tight ${
    isLanding ? "text-white" : "text-text-primary"
  }`}
>
```

In the **desktop** submenu link className, replace the inactive-state class string `"text-text-secondary hover:text-brand-cyan"` with:

```tsx
: isLanding
  ? "text-slate-400 hover:text-brand-cyan"
  : "text-text-secondary hover:text-brand-cyan"
```

In the **mobile** menu: replace the wrapper `className="md:hidden bg-bg-primary border-b border-border-default"` with:

```tsx
className={`md:hidden border-b ${
  isLanding
    ? "bg-[#0A0E16] border-slate-800"
    : "bg-bg-primary border-border-default"
}`}
```

and in the mobile link className replace the inactive-state string `"text-text-secondary hover:text-text-primary"` with:

```tsx
: isLanding
  ? "text-slate-400 hover:text-white"
  : "text-text-secondary hover:text-text-primary"
```

Also make the mobile hamburger button conditional — replace its className with:

```tsx
className={`p-2 ${
  isLanding
    ? "text-slate-400 hover:text-white"
    : "text-text-secondary hover:text-text-primary"
}`}
```

- [ ] **Step 3: Hide the ThemeToggle on the landing route (both desktop and mobile)**

Desktop — wrap the existing toggle block:

```tsx
{
  !isLanding && (
    <div className="ml-2 pl-2 border-l border-border-default">
      <ThemeToggle />
    </div>
  );
}
```

Mobile — replace `<ThemeToggle />` (inside the mobile button group) with:

```tsx
{
  !isLanding && <ThemeToggle />;
}
```

- [ ] **Step 4: Verify**

Run: `cd web && npx tsc -b && npm run lint` — expected: no errors.

Run: `cd web && npm run dev`:

- On `/`: navbar is dark with no theme toggle; "Features" and "How It Works" links smooth-scroll to the bento and steps sections.
- On `/v1` and `/docs`: navbar matches the theme; toggle present and working in both light and dark.
  Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Navbar.tsx
git commit -m "Force dark navbar and hide theme toggle on landing route"
```

---

### Task 11: Changelogs

**Files:**

- Modify: `CHANGELOG.md`
- Note: `web/src/data/changelog.json` entry is added at release time (see Step 2)

- [ ] **Step 1: Add to `CHANGELOG.md` under `## [Unreleased]`**

```markdown
### Added

- Complete landing page redesign ("Refined Dark"): new `web/src/components/landing/` component set — hero with Slack summary mockup, "A day with Daily Dose" walkthrough timeline (`#walkthrough`), features bento (`#features`), curated stats strip (`web/src/data/landingStats.json`), how-it-works steps (`#how-it-works`), FAQ accordion, final CTA band, and dark footer — assembled by `web/src/pages/Home.tsx`. Reusable Slack mock primitives live in `web/src/components/landing/slack/`. The previous landing page is preserved unchanged at `/v1` (`web/src/pages/HomeV1.tsx`, robots noindex). Navbar forces dark styling and hides the theme toggle on `/` only; all other routes keep the light/dark toggle. Landing animations are scroll-triggered Framer Motion reveals respecting `prefers-reduced-motion`.
```

- [ ] **Step 2: Record the user-facing changelog entry for the next release**

`web/src/data/changelog.json` is organized by released version, so the entry goes in when the next version is cut (via the release flow). The exact object to add to that version's `changes` array:

```json
{
  "type": "added",
  "title": "A brand-new landing page",
  "items": [
    "The homepage has a fresh new look that walks you through a full standup day — from morning reminder to posted summary",
    "Prefer the old design? It's still available at /v1"
  ]
}
```

This object is recorded here in the plan; do not invent a version number now.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "Add changelog entry for landing page redesign"
```

---

### Task 12: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full build + lint + format check**

Run: `cd web && npm run build && npm run lint`
Expected: build succeeds (tsc + vite), no lint errors. (`web/` has no `format:check` script — `prettier --write` runs via lint-staged on commit, which is sufficient.)

- [ ] **Step 2: Browser pass (Playwright MCP or manual)**

Run `cd web && npm run dev`, then verify at `http://localhost:5173`:

1. **1440px**: hero, timeline, bento (4+2 / 2+4 / 3+3 rows), stats (3 across), steps (3 across), FAQ, CTA band, footer all render; no stray light-mode surfaces.
2. **768px**: bento collapses sensibly; no overlap.
3. **375px**: single column everywhere, **no horizontal scrollbar** (check `document.documentElement.scrollWidth <= 375`).
4. **Anchors**: from `/docs`, click navbar Home → land on `/`; the Home submenu's "Features" and "How It Works" scroll to the correct sections.
5. **`/v1`**: old page intact; theme toggle visible and functional there.
6. **Reduced motion**: emulate `prefers-reduced-motion: reduce` (DevTools rendering tab or Playwright `emulateMedia`); reload `/` — all content visible immediately, nothing stuck at opacity 0.
7. **Keyboard**: Tab through the page — focus rings visible on CTAs, navbar links, FAQ buttons; FAQ toggles with Enter/Space.

- [ ] **Step 3: Fix anything found, re-run, commit fixes**

```bash
git add -A && git commit -m "Fix issues found in landing page verification pass"
```

(Skip the commit if nothing was found.)

- [ ] **Step 4: Remind the user**

Tell the user: the stats in `web/src/data/landingStats.json` are placeholders — set real values before deploying. The user-facing `changelog.json` entry (Task 11 Step 2) goes in with the next release.
