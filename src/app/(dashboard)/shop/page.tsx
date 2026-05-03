"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import type { ShopItem } from "@/lib/gamification/shop-items";

export default function ShopPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [coins, setCoins] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [s, o] = await Promise.all([
      fetch("/api/gamification/shop").then((r) => (r.ok ? r.json() : { items: [] })),
      session?.user ? fetch("/api/stats/overview").then((r) => (r.ok ? r.json() : null)) : Promise.resolve(null),
    ]);
    setItems(Array.isArray(s.items) ? s.items : []);
    setCoins(typeof o?.coins === "number" ? o.coins : null);
  }, [session?.user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function buy(item: ShopItem) {
    if (!session?.user) {
      toast.error("Sign in to purchase.");
      return;
    }
    setBusy(item.id);
    const r = await fetch("/api/gamification/shop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id }),
    });
    const d = (await r.json().catch(() => null)) as { error?: string; user?: { coins: number } } | null;
    setBusy(null);
    if (!r.ok) {
      toast.error(d?.error ?? "Purchase failed");
      return;
    }
    if (typeof d?.user?.coins === "number") setCoins(d.user.coins);
    toast.success(`${item.name} unlocked!`);
    void load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text md:text-3xl">Shop</h1>
          <p className="mt-1 text-sm text-text-muted">Spend habit coins on freezes and cosmetic unlocks.</p>
        </div>
        {session?.user && coins != null ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-2 font-mono text-sm text-text">
            🪙 <span className="font-semibold">{coins}</span> coins
          </div>
        ) : null}
      </div>

      {!session?.user ? (
        <p className="text-sm text-text-muted">Sign in to see the shop.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="app-card flex flex-col"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{item.kind}</p>
              <h2 className="mt-1 text-lg font-semibold text-text">{item.name}</h2>
              <p className="mt-2 flex-1 text-sm text-text-muted">{item.description}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="font-mono text-lg font-semibold text-text">{item.price} 🪙</span>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={busy === item.id || (coins != null && coins < item.price)}
                  onClick={() => void buy(item)}
                >
                  {busy === item.id ? "…" : "Buy"}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
