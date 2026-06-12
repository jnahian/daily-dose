import { useReducedMotion } from "framer-motion";

/**
 * Spread onto a motion.* element for a scroll-triggered fade-up reveal.
 * Respects prefers-reduced-motion (content renders immediately, no movement).
 */
export const useReveal = (delay = 0) => {
  const reduce = useReducedMotion();
  return {
    initial: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.3, delay, ease: "easeOut" as const },
  };
};
