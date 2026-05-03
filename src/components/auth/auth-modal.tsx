"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useAuthGate } from "./auth-gate-context";

export function AuthModal() {
  const { authModalOpen, setAuthModalOpen } = useAuthGate();

  return (
    <AnimatePresence>
      {authModalOpen ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close"
            onClick={() => setAuthModalOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            className="relative z-10 w-full max-w-md rounded-[var(--card-radius)] border border-border-subtle bg-card p-6 shadow-2xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <h2 id="auth-modal-title" className="text-xl font-semibold text-text">
              Sign in to continue
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              Track habits, join challenges, and chat with your AI coach — sign in to sync your progress.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-ghost order-2 sm:order-1"
                onClick={() => setAuthModalOpen(false)}
              >
                Not now
              </button>
              <Link
                href="/sign-in"
                className="btn-primary order-1 text-center sm:order-2"
                onClick={() => setAuthModalOpen(false)}
              >
                Go to sign in
              </Link>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
