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
