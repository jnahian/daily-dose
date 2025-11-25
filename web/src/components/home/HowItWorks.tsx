import { HowItWorksAnimation } from './HowItWorksAnimation';

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
    <div className="flex-shrink-0">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">How it works</h2>
            <p className="text-gray-400 mb-12">
              Get started in minutes. No complex configuration required.
            </p>

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
          </div>

          <div className="relative">
            <HowItWorksAnimation />
          </div>
        </div>
      </div>
    </section>
  );
};
