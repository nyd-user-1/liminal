"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TextLink } from "@/components/ui/text-link";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <p className="mt-6 text-center text-[15px] text-text-body">
        If an account exists for <span className="font-semibold text-text">{email}</span>, a reset
        link is on its way. Check your inbox, then <TextLink href="/sign-in">return to sign in</TextLink>.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="xl" fullWidth loading={loading}>
        Send reset link
      </Button>
      <p className="text-center text-sm text-text-muted">
        Remembered it? <TextLink href="/sign-in">Sign in</TextLink>
      </p>
    </form>
  );
}
