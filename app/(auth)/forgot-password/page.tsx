import { Logo } from "@/components/ui/logo";
import { ForgotPasswordForm } from "./forgot-password-form";

// Request a reset link by email. Always confirms — never reveals whether an
// account exists.

export const metadata = { title: "Reset your password · Liminal" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sidebar-bg px-4 py-10">
      <Logo variant="onNavy" size="lg" className="mb-8" />
      <div className="w-full max-w-md rounded-card bg-surface p-8 shadow-menu">
        <h1 className="text-center text-[28px] font-bold text-text">Reset your password</h1>
        <p className="mt-1 text-center text-[15px] text-text-muted">
          Enter your email and we&apos;ll send you a reset link
        </p>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
