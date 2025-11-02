"use client";

import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";

const steps = [
  {
    number: "01",
    title: "Add to Slack",
    description: "Install Daily Dose to your Slack workspace with one click.",
  },
  {
    number: "02",
    title: "Create Team",
    description: "Set up your team in a channel and configure standup times.",
  },
  {
    number: "03",
    title: "Get Reminders",
    description:
      "Team members receive automated DM reminders at the scheduled time.",
  },
  {
    number: "04",
    title: "Submit Updates",
    description:
      "Fill out the standup form with yesterday's tasks, today's plan, and blockers.",
  },
  {
    number: "05",
    title: "Auto-Post",
    description:
      "Summary is automatically posted to the team channel for everyone to see.",
  },
];

export default function HowItWorks() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section id="how-it-works" ref={ref} className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get started in minutes with our simple 5-step process
          </p>
        </div>

        <div className="space-y-12">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="flex flex-col md:flex-row items-center gap-8 transition-all duration-500"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible
                  ? "translateX(0)"
                  : `translateX(${index % 2 === 0 ? "-20px" : "20px"})`,
                transitionDelay: `${index * 100}ms`,
              }}
            >
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {step.number}
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-600 text-lg">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
