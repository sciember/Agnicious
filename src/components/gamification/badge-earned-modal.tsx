"use client";

import { AnimatePresence, motion } from "framer-motion";

export type BadgeEarned = { code: string; title: string; description: string };

type Props = {
  badge: BadgeEarned | null;
  onClose: () => void;
};

export function BadgeEarnedModal({ badge, onClose }: Props) {
  return (
    <AnimatePresence>
      {badge ? (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal
          aria-labelledby="badge-earned-title"
        >
          <motion.div
            className="max-w-sm rounded-3xl border border-border bg-card px-8 py-8 text-center shadow-2xl"
            initial={{ scale: 0.9, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400/20 text-3xl"
              animate={{ rotate: [0, -6, 6, 0] }}
              transition={{ duration: 0.6 }}
              aria-hidden
            >
              🏅
            </motion.div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Badge unlocked</p>
            <h2 id="badge-earned-title" className="mt-2 text-xl font-semibold text-text">
              {badge.title}
            </h2>
            <p className="mt-2 text-sm text-text-muted">{badge.description}</p>
            <button type="button" className="btn-primary mt-6 w-full" onClick={onClose}>
              Awesome
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
