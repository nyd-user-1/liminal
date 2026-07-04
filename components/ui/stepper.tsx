import { Icon } from "@/components/ui/icons";

// Catalog `Stepper` — numbered circles (done ✓ · active primary fill ·
// upcoming grey) + labels + connector lines. `active` is a 0-based index.

export function Stepper({
  steps,
  active,
  className = "",
}: {
  steps: string[];
  active: number;
  className?: string;
}) {
  return (
    <ol className={`flex items-center ${className}`}>
      {steps.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <span className="flex items-center gap-2">
              <span
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  done || current ? "bg-primary text-white" : "bg-canvas text-text-muted"
                }`}
              >
                {done ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <span className={`text-sm font-medium ${current ? "text-text" : "text-text-muted"}`}>{label}</span>
            </span>
            {i < steps.length - 1 && <span className={`mx-3 h-px flex-1 ${done ? "bg-primary" : "bg-border"}`} />}
          </li>
        );
      })}
    </ol>
  );
}
