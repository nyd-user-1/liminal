"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Logo } from "@/components/ui/logo";

// Sign-in screen (catalog §4 "Welcome back", Liminal branding): navy
// backdrop, white AuthCard, teal CTA, amber links, demo credentials hint.

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign in failed.");
        return;
      }
      router.push(data.user.role === "client" ? "/portal" : "/calendar");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sidebar-bg px-4 py-10">
      <Logo variant="onNavy" size="lg" className="mb-8" />
      <div className="w-full max-w-md rounded-card bg-surface p-8 shadow-menu">
        <h1 className="text-center text-[28px] font-bold text-text">Welcome back</h1>
        <p className="mt-1 text-center text-[15px] text-text-muted">Sign in to your Liminal workspace</p>

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
          <Field
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            trailing={
              <IconButton
                icon={showPassword ? "eye-off" : "eye"}
                label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((s) => !s)}
              />
            }
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" size="xl" fullWidth loading={loading}>
            Sign in
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-text-muted">
          Forgot your password?{" "}
          <a href="mailto:support@liminal.demo" className="font-semibold text-accent-ink hover:underline">
            Contact support
          </a>
        </p>
      </div>

      <div className="mt-6 w-full max-w-md rounded-card border border-sidebar-active bg-sidebar-active/40 p-4 text-sm text-sidebar-text">
        <p className="font-semibold text-white">Demo credentials</p>
        <p className="mt-1">
          Practitioner: <span className="text-accent">brendan@liminal.demo</span> · Client:{" "}
          <span className="text-accent">casey@liminal.demo</span> — password{" "}
          <span className="font-semibold text-white">demo</span>
        </p>
      </div>
    </div>
  );
}
