"use client";

import { motion } from "framer-motion";

export function PageFade({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}
