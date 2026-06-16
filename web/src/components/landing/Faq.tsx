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
