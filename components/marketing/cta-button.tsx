"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

// Navigating CTA — a Button that pushes a route on click. Lets server
// components use the Button primitive for links without nesting <button> in
// an <a>.

export function CtaButton({
  href,
  children,
  ...rest
}: { href: string } & Omit<ComponentProps<typeof Button>, "onClick">) {
  const router = useRouter();
  return (
    <Button onClick={() => router.push(href)} {...rest}>
      {children}
    </Button>
  );
}
