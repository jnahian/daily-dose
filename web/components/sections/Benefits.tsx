"use client";

import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";

const benefits = [
  {
    title: "Save Time",
    description:
      "Eliminate manual coordination. Standups happen automatically at your chosen time.",
  },
  {
    title: "Increase Transparency",
    description:
      "Everyone sees what teammates are working on, fostering collaboration and alignment.",
  },
  {
    title: "Stay Organized",
    description:
      "All standup data is tracked and organized by date, making it easy to review progress.",
  },
  {
    title: "Flexible & Configurable",
    description:
      "Customize reminder times, posting schedules, and work days to fit your team's workflow.",
  },
];

export default function Benefits() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section id="benefits" ref={ref} className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why Teams Love Daily Dose
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Built to make your team more productive and synchronized
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className="p-8 border-l-4 border-primary bg-gray-50 transition-all duration-500"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(20px)",
                transitionDelay: `${index * 100}ms`,
              }}
            >
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                {benefit.title}
              </h3>
              <p className="text-gray-600 text-lg">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
