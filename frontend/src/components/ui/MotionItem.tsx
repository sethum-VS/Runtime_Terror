"use client";

import { motion, useReducedMotion } from "framer-motion";
import { pickPageVariants } from "@/lib/animations";

interface MotionItemProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Stagger-aware block. Drop around any page section.
 * Inherits initial/animate from the nearest pageContainer ancestor (template.tsx).
 * No initial/animate props needed here — variant names match the orchestrator.
 */
export function MotionItem({ children, className }: MotionItemProps) {
  const reduced = useReducedMotion();
  const { item } = pickPageVariants(reduced);
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
