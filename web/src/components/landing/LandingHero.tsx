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
