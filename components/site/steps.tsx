import { Icon, type IconName } from "@/components/ui/icons";

// Numbered "how it works" steps — a light, marketing-styled row. Composed from
// tokens + the Icon primitive. NEW (public marketing site).

export interface Step {
  title: string;
  body: string;
  icon: IconName;
}

export function Steps({ steps, className = "" }: { steps: Step[]; className?: string }) {
  return (
    <ol className={`grid gap-8 sm:grid-cols-3 ${className}`}>
      {steps.map((s, i) => (
        <li key={s.title}>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-wash font-display text-lg font-bold text-primary-deep">
              {i + 1}
            </span>
            <Icon name={s.icon} size={20} className="text-primary" />
          </div>
          <h3 className="mt-4 font-display text-xl font-semibold text-text">{s.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-text-body">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
