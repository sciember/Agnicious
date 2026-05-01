"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: "/dashboard",
    });
    if (result?.error) setError("Invalid credentials");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-6">
      <form onSubmit={onSubmit} className="app-card w-full space-y-3">
        <h1 className="text-2xl font-semibold">Sign In</h1>
        <input
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="w-full rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white">Continue</button>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="w-full rounded-lg border border-zinc-700 px-4 py-2 font-medium"
        >
          Continue with Google
        </button>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </form>
    </main>
  );
}
