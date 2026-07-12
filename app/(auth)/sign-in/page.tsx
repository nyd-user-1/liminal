"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Icon } from "@/components/ui/icons";
import { Logo } from "@/components/ui/logo";
import { TextLink } from "@/components/ui/text-link";

// Sign-in screen (catalog §4 "Welcome back", Leuk branding): navy
// backdrop, white AuthCard, teal CTA, amber links, demo credentials hint.

// Click-to-copy demo credential (same affordance vocabulary as the
// design-system page: copy icon on hover, green check for 1.2s on copy).
function CopyValue({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={`Copy ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
      className={`group/copy inline-flex items-baseline gap-1 rounded-sm underline decoration-dotted decoration-transparent underline-offset-4 transition-colors hover:decoration-current focus-visible:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      {value}
      <Icon
        name={copied ? "check" : "copy"}
        size={12}
        className={`self-center transition-opacity ${
          copied ? "text-success opacity-100" : "opacity-0 group-hover/copy:opacity-70 group-focus-visible/copy:opacity-70"
        }`}
      />
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}

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
        <p className="mt-1 text-center text-[15px] text-text-muted">Sign in to your Leuk workspace</p>

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
          Forgot your password? <TextLink href="/forgot-password">Reset it</TextLink>
        </p>
      </div>

      <div className="mt-6 w-full max-w-md rounded-card border border-sidebar-active bg-sidebar-active/40 p-4 text-sm text-sidebar-text">
        <p className="font-semibold text-white">Demo credentials</p>
        <div className="mt-1.5 space-y-1">
          <p>
            Practitioner: <CopyValue value="brendan@liminal.demo" className="text-accent" />
          </p>
          <p>
            Client: <CopyValue value="casey@liminal.demo" className="text-accent" />
          </p>
          <p>
            Password: <CopyValue value="demo" className="font-semibold text-white" />
          </p>
        </div>
      </div>
    </div>
  );
}
