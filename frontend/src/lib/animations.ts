import type { Variants } from "framer-motion";

const ease = [0.25, 0.1, 0.25, 1] as const;

/** Parent: orchestrates stagger; no opacity on container → avoids route flash. */
export const pageContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.04,
      when: "beforeChildren",
    },
  },
};

/** Child blocks: fade + slight lift (use on motion.* under pageContainer). */
export const itemFadeInUpVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease },
  },
};

export const pageContainerReducedMotion: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0,
      when: "beforeChildren",
    },
  },
};

export const itemFadeInUpReducedMotion: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.22, ease: "easeOut" },
  },
};

export function pickPageVariants(reducedMotion: boolean | null) {
  const reduced = reducedMotion === true;
  return reduced
    ? {
        page: pageContainerReducedMotion,
        item: itemFadeInUpReducedMotion,
      }
    : {
        page: pageContainerVariants,
        item: itemFadeInUpVariants,
      };
}
