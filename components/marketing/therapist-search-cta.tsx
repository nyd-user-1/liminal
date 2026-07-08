import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";

// Reusable marketing CTA — centered "find a therapist" search. A native GET form
// posts to /find-care, composed from the kit SearchInput + Button. Used on the
// home page and shown in the design system.
export function TherapistSearchCta({
  heading = "Find a therapist without the guesswork",
  body = "Search by specialty, location, and coverage — all in one place.",
  placeholder = "Search by ZIP, specialty, or name…",
}: {
  heading?: string;
  body?: string;
  placeholder?: string;
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 text-center">
      <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">{heading}</h2>
      <p className="mx-auto mt-4 max-w-lg text-pretty text-lg leading-relaxed text-text-body">{body}</p>
      <form action="/find-care" className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
        <SearchInput name="q" placeholder={placeholder} className="flex-1" />
        <Button type="submit" className="shrink-0 h-10">
          Find your provider
        </Button>
      </form>
    </div>
  );
}
