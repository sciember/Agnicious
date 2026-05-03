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
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-background px-6">
      <form onSubmit={onSubmit} className="app-card w-full space-y-3">
        <h1 className="text-2xl font-semibold text-text">Sign In</h1>
        <input
          className="input-field"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input-field"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="btn-primary w-full">
          Continue
        </button>
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="btn-ghost w-full"
        >
          Continue with Google
        </button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </form>
    </main>
  );
}
