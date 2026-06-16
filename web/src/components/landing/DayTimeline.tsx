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
