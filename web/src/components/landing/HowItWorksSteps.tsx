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
