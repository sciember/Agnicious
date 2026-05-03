"use client";

import { motion, AnimatePresence } from "framer-motion";
import { levelDisplayName } from "@/lib/gamification/levels";

type Props = {
  open: boolean;
  level: number;
  onClose: () => void;
};

export function LevelUpModal({ open, level, onClose }: Props) {
  const name = levelDisplayName(level);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal
          aria-labelledby="level-up-title"
        >
          <motion.div
            className="relative max-w-sm overflow-hidden rounded-3xl border border-border bg-card px-8 py-10 text-center shadow-2xl"
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {["⭐", "✨", "🌟"].map((s, i) => (
                <motion.span
                  key={i}
                  className="absolute text-2xl"
                  style={{ left: `${20 + i * 28}%`, top: `${12 + (i % 2) * 8}%` }}
                  animate={{ y: [0, -6, 0], rotate: [0, 8, -6, 0], opacity: [0.5, 1, 0.6] }}
                  transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.2 }}
                >
                  {s}
                </motion.span>
              ))}
            </div>
            <p id="level-up-title" className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Level up
            </p>
            <motion.h2
              className="mt-3 font-mono text-4xl font-bold text-text tabular-nums"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
            >
              LEVEL {level}
            </motion.h2>
            <p className="mt-2 text-lg font-semibold text-text">{name}</p>
            <p className="mt-2 text-sm text-text-muted">Keep stacking wins — you&apos;re building real momentum.</p>
            <button type="button" className="btn-primary mt-8 w-full" onClick={onClose}>
              Let&apos;s go
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
