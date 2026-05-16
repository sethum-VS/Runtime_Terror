"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { pickPageVariants } from "@/lib/animations";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const reduced = useReducedMotion();
  const { page } = pickPageVariants(reduced);

  return (
    <motion.div
      key={pathname}
      className="flex flex-1 flex-col"
      variants={page}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}
