import { HowItWorksAnimation } from './HowItWorksAnimation';
import { LordIcon } from '../LordIcon';

interface StepProps {
  number: string;
  title: string;
  description: string;
  isLast?: boolean;
}

const Step = ({ number, title, description, isLast }: StepProps) => (
  <div className="flex gap-6 relative">
    {!isLast && (
      <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gradient-to-b from-brand-cyan/30 to-transparent" />
    )}
    <div className="shrink-0">
      <div className="w-12 h-12 rounded-full bg-brand-navy-light border border-brand-cyan/30 flex items-center justify-center text-brand-cyan font-bold text-xl shadow-[0_0_15px_rgba(0,207,255,0.2)]">
        {number}
      </div>
    </div>
    <div className="pb-16">
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  </div>
);

export const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 bg-brand-navy-light/30 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-brand-navy-light rounded-2xl flex items-center justify-center border border-white/5 shadow-[0_0_30px_rgba(0,207,255,0.1)]">
              <LordIcon
                src="https://cdn.lordicon.com/uukerzzv.json"
                trigger="loop"
                delay={2000}
                colors="primary:#00cfff,secondary:#00afff"
                size={40}
              />
            </div>
            <span>
              How it works
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Get started in minutes. No complex configuration required.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">


          <div className="space-y-2">
            <Step
              number="1"
              title="Add to Slack"
              description="Install the bot to your workspace with a single click. It's secure and requires minimal permissions."
            />
            <Step
              number="2"
              title="Create a Team"
              description="Use the /dd-team-create command to set up your team and choose your standup schedule."
            />
            <Step
              number="3"
              title="Start Syncing"
              description="The bot will automatically remind members and post summaries. Sit back and relax."
              isLast
            />
          </div>

          <div className="relative">
            <HowItWorksAnimation />
          </div>
        </div>
      </div>
    </section>
  );
};
