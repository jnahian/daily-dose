import { motion } from "framer-motion";
import { useReveal } from "./motion";

export const DemoVideo = () => (
  <section id="demo" className="px-4 py-24 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-4xl">
      <motion.div {...useReveal()} className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
          See it in action
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
          A two-minute walkthrough of Daily Dose running a standup inside Slack.
        </p>
      </motion.div>

      <motion.div {...useReveal(0.15)} className="relative mx-auto max-w-3xl">
        <div className="absolute inset-0 -z-10 mx-auto h-3/4 w-3/4 rounded-full bg-brand-cyan/10 blur-[100px]" />
        <div className="aspect-video overflow-hidden rounded-2xl border border-slate-800 bg-[#0F1626] shadow-2xl">
          <iframe
            className="h-full w-full"
            src="https://www.youtube-nocookie.com/embed/bQrJqBpSlBU"
            title="Daily Dose demo video"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </motion.div>
    </div>
  </section>
);
