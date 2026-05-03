"use client";

import { FormEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { X } from "lucide-react";
import { useAuthGate } from "./auth-gate-context";

export function AuthModal() {
  const { authModalOpen, setAuthModalOpen } = useAuthGate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/",
    });
    setBusy(false);
    if (result?.error) {
      setError("Invalid credentials");
      return;
    }
    setAuthModalOpen(false);
  }

  return (
    <AnimatePresence>
      {authModalOpen ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-md" aria-label="Close" onClick={() => setAuthModalOpen(false)} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            className="relative z-10 w-full max-w-md rounded-[var(--card-radius)] border border-border bg-card p-6 shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              aria-label="Close auth modal"
              className="absolute right-4 top-4 rounded-full p-1 text-text-muted hover:bg-canvas hover:text-text"
              onClick={() => setAuthModalOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            <h2 id="auth-modal-title" className="text-xl font-semibold text-text">
              Sign in to continue
            </h2>
            <p className="mt-2 text-sm text-text-muted">Join free to track habits & tasks</p>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                className="btn-primary w-full"
                disabled={busy}
                onClick={() => void signIn("google", { callbackUrl: "/" })}
              >
                Continue with Google
              </button>
              <form className="space-y-2" onSubmit={onEmailSignIn}>
                <input
                  className="input-field"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
                <input
                  className="input-field"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
                <button type="submit" className="btn-ghost w-full" disabled={busy}>
                  Continue with Email
                </button>
              </form>
              {error ? <p className="text-sm text-danger">{error}</p> : null}
              <button type="button" className="btn-ghost w-full" onClick={() => setAuthModalOpen(false)}>
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
