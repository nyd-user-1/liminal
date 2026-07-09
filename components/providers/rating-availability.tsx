import { Icon, type IconName } from "@/components/ui/icons";

// Shared "★ rating (count) / 📅 Available <date>" pair — used on the
// homepage spotlight card, the find-care result cards, and the real provider
// profile header. Omit entirely at the call site when rating data isn't
// available. `secondLine` swaps the availability row for something else
// (program cards: "Serving <where> for <N> years").

export function RatingAvailability({
  rating,
  reviewCount,
  availableLabel,
  secondLine,
  className = "",
}: {
  rating: number;
  reviewCount: number;
  availableLabel?: string;
  secondLine?: { icon: IconName; text: string };
  className?: string;
}) {
  const line = secondLine ?? (availableLabel ? { icon: "calendar-check" as IconName, text: `Available ${availableLabel}` } : null);
  return (
    <div className={`flex flex-col gap-1 text-[14px] ${className}`}>
      <span className="flex items-center gap-1.5 text-text">
        <Icon name="star" size={15} className="fill-current text-accent" />
        <span className="font-semibold">{rating.toFixed(1)}</span>
        <span className="text-text-muted">({reviewCount})</span>
      </span>
      {line && (
        <span className="flex items-center gap-1.5 text-text-body">
          <Icon name={line.icon} size={15} className="shrink-0 text-primary" />
          {line.text}
        </span>
      )}
    </div>
  );
}
