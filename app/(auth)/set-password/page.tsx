import { Logo } from "@/components/ui/logo";
import { SetPasswordForm } from "./set-password-form";

// Set/reset password via a one-time emailed token (?token=…). Same navy
// backdrop + white AuthCard as sign-in.

export const metadata = { title: "Set your password · Liminal" };

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sidebar-bg px-4 py-10">
      <Logo variant="onNavy" size="lg" className="mb-8" />
      <div className="w-full max-w-md rounded-card bg-surface p-8 shadow-menu">
        <h1 className="text-center text-[28px] font-bold text-text">Choose a password</h1>
        <p className="mt-1 text-center text-[15px] text-text-muted">
          Set a password for your Liminal client portal
        </p>
        <SetPasswordForm token={token ?? ""} />
      </div>
    </div>
  );
}
