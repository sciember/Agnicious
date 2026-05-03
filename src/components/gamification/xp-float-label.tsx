"use client";

import { AnimatePresence, motion } from "framer-motion";

export type XpFloatItem = { id: string; amount: number; x: number; y: number };

type Props = {
  items: XpFloatItem[];
};

export function XpFloatLayer({ items }: Props) {
  return (
    <AnimatePresence>
      {items.map((item) => (
        <motion.span
          key={item.id}
          className="pointer-events-none fixed z-[90] font-mono text-sm font-bold text-success"
          style={{ left: item.x, top: item.y }}
          initial={{ opacity: 1, y: 0, scale: 1 }}
          animate={{ opacity: 0, y: -36, scale: 1.05 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        >
          +{item.amount} XP
        </motion.span>
      ))}
    </AnimatePresence>
  );
}
