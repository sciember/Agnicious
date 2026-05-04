"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LogIn, X } from "lucide-react";

export function SignInRequiredModal({
  open,
  title = "Please sign in",
  message = "Sign in to continue.",
  ctaLabel = "Sign In",
  onClose,
  onSignIn,
}: {
  open: boolean;
  title?: string;
  message?: string;
  ctaLabel?: string;
  onClose: () => void;
  onSignIn: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-[14px] border border-border bg-card p-5 shadow-xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-2 text-text-muted hover:bg-canvas hover:text-text"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <LogIn className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-text">{title}</p>
                <p className="mt-1 text-sm text-text-muted">{message}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>
                Not now
              </button>
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-2"
                onClick={() => {
                  onClose();
                  onSignIn();
                }}
              >
                <LogIn className="h-4 w-4" />
                {ctaLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

