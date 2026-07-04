"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `Toast` — floating bottom-right pill: status-icon circle + message
// + close ×; auto-dismisses. Provider mounts once in app/layout.tsx; anywhere
// below: const toast = useToast(); toast("Invoice sent", "success").

type ToastVariant = "info" | "success" | "warning" | "danger";

interface ToastItem {
  id: number;
  message: ReactNode;
  variant: ToastVariant;
}

const styles: Record<ToastVariant, { icon: IconName; circle: string }> = {
  info: { icon: "bell", circle: "bg-info-tint text-info" },
  success: { icon: "check", circle: "bg-success-tint text-success" },
  warning: { icon: "warning-triangle", circle: "bg-warning-tint text-warning" },
  danger: { icon: "warning-triangle", circle: "bg-danger-tint text-danger" },
};

type ToastFn = (message: ReactNode, variant?: ToastVariant) => void;

const ToastCtx = createContext<ToastFn>(() => {});

/** Fire a toast: `toast("Saved", "success")`. */
export function useToast(): ToastFn {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const nextId = useRef(1);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback<ToastFn>(
    (message, variant = "info") => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, message, variant }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed bottom-6 right-6 z-100 flex flex-col items-end gap-2.5">
            {toasts.map((t) => {
              const s = styles[t.variant];
              return (
                <div
                  key={t.id}
                  role="status"
                  className="pointer-events-auto flex items-center gap-3 rounded-card border border-border bg-surface py-2.5 pl-2.5 pr-3 shadow-menu"
                >
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${s.circle}`}>
                    <Icon name={s.icon} size={16} />
                  </span>
                  <span className="text-[15px] text-text">{t.message}</span>
                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    aria-label="Dismiss"
                    className="text-text-muted transition-colors hover:text-text"
                  >
                    <Icon name="x" size={16} />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastCtx.Provider>
  );
}
