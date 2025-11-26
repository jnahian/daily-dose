import { motion } from 'framer-motion';
import { useId } from 'react';
import { LordIcon } from '../LordIcon';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
  delay: number;
}

const FeatureCard = ({ title, description, icon, delay }: FeatureCardProps) => {
  const id = useId();
  // Convert the ID to a valid CSS selector format (remove colons)
  const safeId = `feature-${id.replace(/:/g, '')}`;

  return (
    <motion.div
      id={safeId}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      className="bg-bg-surface p-8 rounded-3xl border border-border-default hover:border-brand-cyan/30 transition-all group hover:shadow-[0_0_30px_rgba(0,207,255,0.05)]"
    >
      <div className="w-14 h-14 bg-bg-primary rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-border-default">
        <LordIcon
          src={icon}
          trigger="hover"
          target={`#${safeId}`}
          colors="primary:#00cfff,secondary:#00afff"
          size={32}
        />
      </div>
      <h3 className="text-xl font-bold text-text-primary mb-3">{title}</h3>
      <p className="text-text-secondary leading-relaxed">{description}</p>
    </motion.div>
  );
};

export const Features = () => {
  const features = [
    {
      title: 'Automated Reminders',
      description:
        'Set it and forget it. The bot automatically reminds your team to submit their standups at your chosen time.',
      icon: 'https://cdn.lordicon.com/kbtmbyzy.json',
      delay: 0.1,
    },
    {
      title: 'Smart Summaries',
      description:
        "Get a beautifully formatted summary of everyone's updates posted directly to your Slack channel.",
      icon: 'https://cdn.lordicon.com/nocovwne.json',
      delay: 0.2,
    },
    {
      title: 'Timezone Aware',
      description:
        'Perfect for remote teams. Configure standup times per team to match their local working hours.',
      icon: 'https://cdn.lordicon.com/abfverha.json',
      delay: 0.3,
    },
    {
      title: 'Leave Management',
      description:
        "Mark yourself as away or on vacation. The bot won't bug you while you're recharging.",
      icon: 'https://cdn.lordicon.com/hursldrn.json',
      delay: 0.4,
    },
    {
      title: 'Multiple Teams',
      description:
        'Support for multiple teams within a single organization. Engineering, Marketing, Design - all covered.',
      icon: 'https://cdn.lordicon.com/uukerzzv.json',
      delay: 0.5,
    },
    {
      title: 'Detailed History',
      description: 'Access past standups easily. Keep a record of progress and blockers over time.',
      icon: 'https://cdn.lordicon.com/gqdnbnwt.json',
      delay: 0.6,
    },
  ];

  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-bg-surface rounded-2xl flex items-center justify-center border border-border-default shadow-[0_0_30px_rgba(0,207,255,0.1)]">
              <LordIcon
                src="https://cdn.lordicon.com/osuxyevn.json"
                trigger="loop"
                delay={2000}
                colors="primary:#00cfff,secondary:#00afff"
                size={40}
              />
            </div>
            <span>
              Everything you need to <br />
              sync your team
            </span>
          </h2>
          <p className="text-text-secondary max-w-2xl mx-auto">
            Powerful features designed to make daily updates effortless and effective.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
};
