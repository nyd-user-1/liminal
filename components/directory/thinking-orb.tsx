// ThinkingOrb — the amber watercolor orb that fronts the chat assistant.
// While the assistant is generating (`isThinking`), it breathes: a slow
// scale/opacity pulse (.orb-pulse in globals.css — 2.4s cycle, no rotation,
// disabled under prefers-reduced-motion). When done it rests at full
// opacity/scale. Drop-in for the /chat message stream: standalone while
// waiting, trailing the streamed text while it arrives.

interface Props {
  /** Rendered box in px. */
  size?: number;
  /** Animate while true; static at rest when false. */
  isThinking?: boolean;
  className?: string;
}

export function ThinkingOrb({ size = 32, isThinking = false, className = "" }: Props) {
  return (
    <span
      className={`inline-flex select-none items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <picture className={isThinking ? "orb-pulse" : undefined}>
        <source srcSet="/leuk-logo-full.avif" type="image/avif" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/leuk-logo-full.png"
          alt=""
          width={size}
          height={size}
          draggable={false}
          className="h-full w-full object-contain"
          style={{ width: size, height: size }}
        />
      </picture>
    </span>
  );
}
