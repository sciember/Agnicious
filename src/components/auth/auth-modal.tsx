"use client";

import { FormEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { X } from "lucide-react";
import { useAuthModal } from "./auth-modal-context";

function GoogleMark() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function AuthModal() {
  const { authModalOpen, setAuthModalOpen } = useAuthModal();
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
          <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-md" aria-label="Close" onClick={() => setAuthModalOpen(false)} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            className="relative z-10 w-full max-w-[400px] rounded-[14px] border border-[#E5E7EB] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-2 text-[#6B7280] hover:bg-[#F3F4F6]"
              onClick={() => setAuthModalOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-5 flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">A</div>
              <p className="mt-2 text-xs font-semibold tracking-wide text-[#6B7280]">Sciember</p>
            </div>

            <h2 id="auth-modal-title" className="text-center text-xl font-semibold text-[#111827]">
              Sign in to continue
            </h2>
            <p className="mt-2 text-center text-sm text-[#6B7280]">Join free — track habits, tasks & reach goals</p>

            <div className="mt-6 space-y-4">
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm font-semibold text-[#374151] shadow-sm transition hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy}
                onClick={() => void signIn("google", { callbackUrl: "/dashboard" })}
              >
                <GoogleMark />
                Continue with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#E5E7EB]" />
                <span className="text-xs font-medium uppercase text-[#9CA3AF]">or</span>
                <div className="h-px flex-1 bg-[#E5E7EB]" />
              </div>

              <form className="space-y-2" onSubmit={onEmailSignIn}>
                <input
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none ring-indigo-500 focus:ring-2"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
                <input
                  className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm outline-none ring-indigo-500 focus:ring-2"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-50"
                  disabled={busy}
                >
                  Continue with email
                </button>
              </form>
              {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
            </div>

            <p className="mt-6 text-center text-xs text-[#6B7280]">Your data stays private and secure 🔒</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
