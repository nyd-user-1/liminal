"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { TextLink } from "@/components/ui/text-link";

export function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <p className="mt-6 text-center text-[15px] text-text-body">
        This link is missing its token. Open the link from your email again, or{" "}
        <TextLink href="/forgot-password">request a new one</TextLink>.
      </p>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not set your password.");
        return;
      }
      router.push("/portal");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      <Field
        label="New password"
        name="password"
        type={show ? "text" : "password"}
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 8 characters"
        trailing={
          <IconButton
            icon={show ? "eye-off" : "eye"}
            label={show ? "Hide password" : "Show password"}
            onClick={() => setShow((s) => !s)}
          />
        }
      />
      <Field
        label="Confirm password"
        name="confirm"
        type={show ? "text" : "password"}
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Same password again"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="xl" fullWidth loading={loading}>
        Set password and sign in
      </Button>
    </form>
  );
}
