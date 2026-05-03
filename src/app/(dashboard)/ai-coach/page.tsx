"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useAuthGate } from "@/components/auth/auth-gate-context";

type ChatTurn = { role: "user" | "assistant"; text: string };

const chips: { label: string; detail?: boolean }[] = [
  { label: "Analyze my productivity today", detail: true },
  { label: "Why am I not completing tasks?" },
  { label: "Build me a morning routine" },
  { label: "What should I focus on right now?" },
  { label: "Give me a full weekly report", detail: true },
  { label: "I keep skipping my habit" },
  { label: "How to build a routine?" },
];

export default function AICoachPage() {
  const { requireAuth } = useAuthGate();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const send = useCallback(
    async (text: string, opts?: { detailReport?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const detailReport =
        opts?.detailReport ??
        /analyze my productivity|full weekly report|weekly report|deep dive/i.test(trimmed);
      setMessages((m) => [...m, { role: "user", text: trimmed }]);
      setInput("");
      setLoading(true);
      try {
        const res = await fetch("/api/ai/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: trimmed, detailReport }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data?.error ?? "Coach unavailable.");
          setMessages((m) => [
            ...m,
            { role: "assistant", text: "I couldn’t reach the coach right now. Try again soon." },
          ]);
          return;
        }
        setMessages((m) => [...m, { role: "assistant", text: data.response ?? "" }]);
      } catch {
        toast.error("Network error.");
        setMessages((m) => [...m, { role: "assistant", text: "Something went wrong. Try again." }]);
      } finally {
        setLoading(false);
        setTimeout(scrollToBottom, 50);
      }
    },
    [scrollToBottom],
  );

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text md:text-3xl">AI Coach</h1>
        <p className="mt-1 text-sm text-text-muted">Your personal habit coach</p>
      </div>

      <div className="app-card flex flex-1 flex-col overflow-hidden p-0">
        <div className="max-h-[52vh] flex-1 space-y-4 overflow-y-auto px-4 py-4 md:max-h-[60vh]">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={`${i}-${m.role}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                      : "max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-canvas px-4 py-3 text-sm text-text [&_strong]:text-text [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                  }
                >
                  {m.role === "user" ? (
                    m.text
                  ) : (
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl border border-border bg-card px-4 py-3">
                <span className="typing-dot h-2 w-2 rounded-full bg-text-muted" />
                <span className="typing-dot h-2 w-2 rounded-full bg-text-muted" />
                <span className="typing-dot h-2 w-2 rounded-full bg-text-muted" />
              </div>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <div className="border-t border-border bg-surface px-3 py-3 backdrop-blur-md">
          <div className="mb-2 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.label}
                type="button"
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-text-muted transition hover:border-primary/50 hover:text-text"
                onClick={requireAuth(() => {
                  setInput(c.label);
                  void send(c.label, { detailReport: c.detail });
                })}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder="Ask anything about habits, motivation, or routines…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  requireAuth(() => void send(input))();
                }
              }}
            />
            <button
              type="button"
              className="btn-primary inline-flex shrink-0 items-center gap-2 px-4"
              disabled={loading}
              onClick={requireAuth(() => void send(input))}
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
