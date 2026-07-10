import { EmptyState } from "@/components/ui/empty-state";

// Right pane of the inbox split view when no thread is open. Below lg the
// list pane owns the screen, so this only renders on desktop.

export default function InboxPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon="inbox"
        title="Select a conversation"
        subtext="Choose a thread from the list, or compose a new message."
      />
    </div>
  );
}
