"use client";

import Button from "@/components/ui/Button";
import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";
import { cn } from "@/lib/utils/cn";

export default function Hero() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section
      ref={ref}
      className={cn(
        "relative min-h-screen flex items-center justify-center",
        "bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent",
        "transition-opacity duration-1000",
        {
          "opacity-100": isVisible,
          "opacity-0": !isVisible,
        }
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6 animate-fade-in">
          Streamline Your Team&apos;s{" "}
          <span className="text-primary">Daily Standups</span>
        </h1>

        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto animate-slide-in">
          Automate standup meetings, collect updates seamlessly, and keep your
          team synchronized—all within Slack.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-in">
          <Button variant="primary" size="lg">
            Add to Slack
          </Button>
          <Button variant="outline" size="lg">
            View Documentation
          </Button>
        </div>
      </div>
    </section>
  );
}
