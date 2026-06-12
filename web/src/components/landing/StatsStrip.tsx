import { motion } from "framer-motion";
import { useReveal } from "./motion";
import statsData from "../../data/landingStats.json";

export const StatsStrip = () => (
  <section
    aria-labelledby="stats-heading"
    className="px-4 py-16 sm:px-6 lg:px-8"
  >
    <h2 id="stats-heading" className="sr-only">
      Daily Dose by the numbers
    </h2>
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
