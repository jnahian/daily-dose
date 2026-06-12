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
